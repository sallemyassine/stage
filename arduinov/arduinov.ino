#include <Wire.h>
#include <Adafruit_ADS1X15.h>
#include "DHT.h"
#include <driver/i2s.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <math.h>


#define PIEZO_SAMPLES 200
#define PIEZO_FILTER_SIZE 5
#define PIEZO_SCALE 8.0

float piezoBuffer[PIEZO_FILTER_SIZE] = {0};
bool piezoInitialized = false;
int piezoIndex = 0;

const float TANK_HEIGHT = 24.0;      // cm
const float TANK_RADIUS = 4.0;       // cm
const float TANK_AREA = PI * TANK_RADIUS * TANK_RADIUS;

float previousVolume = -1;
unsigned long previousTime = 0;

const char* ssid = "CRNS WIFI";
const char* password = "Crns#2020#";

//=======================
// MQTT
//=======================
const char* mqtt_server = "10.1.60.42";
const int mqtt_port = 1883;
const char* mqtt_topic = "capteurs/esp32";
WiFiClient espClient;
PubSubClient mqtt(espClient);

//=======================
// DHT11
//=======================
#define DHTPIN 26
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

//=======================
// ADS1115 
//=======================
Adafruit_ADS1115 ads;
//=======================
// I2S MICROPHONE
//=======================
#define I2S_PORT I2S_NUM_0
#define I2S_BCLK 25
#define I2S_WS   23
#define I2S_SD   32
#define I2S_SAMPLES 256
int32_t i2sBuffer[I2S_SAMPLES];
//=======================
// ULTRASON (HC-SR04)
//=======================
#define TRIG_PIN 18
#define ECHO_PIN 19
//=======================
// CAPTEUR DE DEBIT (YF-S201)
//=======================
#define FLOW_PIN 4
volatile unsigned long pulseCount = 0;
const float FLOW_CALIBRATION_FACTOR = 7.5; // Hz = 7.5 * Q(L/min)

void IRAM_ATTR flowPulseISR()
{
  pulseCount++;
}
//=======================
// WIFI CONNECT
//=======================
void setup_wifi()
{
  Serial.print("Connexion WiFi");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.println("WiFi OK");
  Serial.println(WiFi.localIP());
}
//=======================
// MQTT RECONNECT
//=======================
void reconnectMQTT()
{
  while (!mqtt.connected())
  {
    Serial.println("Connexion MQTT...");
    if (mqtt.connect("ESP32_SENSOR"))
    {
      Serial.println("MQTT connecte");
    }
    else
    {
      Serial.print("Erreur MQTT ");
      Serial.println(mqtt.state());
      delay(3000);
    }
  }
}
//=======================
// MICROPHONE : RAW + RMS
//=======================
void readMic(int32_t &micRaw, float &micRMS)
{
  size_t bytesRead = 0;
  i2s_read(I2S_PORT, i2sBuffer, sizeof(i2sBuffer), &bytesRead, portMAX_DELAY);
  int samplesRead = bytesRead / sizeof(int32_t);
  if (samplesRead <= 0)
  {
    micRaw = 0;
    micRMS = 0;
    return;
  }

  double sum = 0.0;
  int32_t adjustedSamples[I2S_SAMPLES];
  for (int i = 0; i < samplesRead; i++)
  {
    adjustedSamples[i] = i2sBuffer[i] >> 14;
    sum += adjustedSamples[i];
  }
  double mean = sum / samplesRead;

  micRaw = adjustedSamples[samplesRead - 1];

  double sumSquares = 0.0;
  for (int i = 0; i < samplesRead; i++)
  {
    double centered = adjustedSamples[i] - mean;
    sumSquares += centered * centered;
  }
  micRMS = sqrt(sumSquares / samplesRead);
}
//=======================
// PIEZO : RMS + MISE A L'ECHELLE (0-200 repos / >200 vibration)
//=======================
float readPiezoRMS()
{
  float samples[PIEZO_SAMPLES];
  double sum = 0;
  for (int i = 0; i < PIEZO_SAMPLES; i++)
  {
    samples[i] = ads.readADC_SingleEnded(0);
    sum += samples[i];
    delayMicroseconds(500);
  }

  double mean = sum / PIEZO_SAMPLES;

  double sumSquares = 0;
  for (int i = 0; i < PIEZO_SAMPLES; i++)
  {
    double centered = samples[i] - mean;
    sumSquares += centered * centered;
  }

  float rms = sqrt(sumSquares / PIEZO_SAMPLES);
  // Mise a l'echelle : ajustez PIEZO_SCALE selon vos tests reels
  float scaled = rms * PIEZO_SCALE;

  return scaled;
}
// Filtre median : lisse les pics parasites avant envoi
float medianPiezoFilter(float newValue)
{
  if (!piezoInitialized)
  {
    for (int i = 0; i < PIEZO_FILTER_SIZE; i++)
    {
      piezoBuffer[i] = newValue;
    }
    piezoInitialized = true;
  }

  piezoBuffer[piezoIndex] = newValue;
  piezoIndex++;
  if (piezoIndex >= PIEZO_FILTER_SIZE)
    piezoIndex = 0;

  float temp[PIEZO_FILTER_SIZE];
  for (int i = 0; i < PIEZO_FILTER_SIZE; i++)
  {
    temp[i] = piezoBuffer[i];
  }
  for (int i = 0; i < PIEZO_FILTER_SIZE - 1; i++)
  {
    for (int j = i + 1; j < PIEZO_FILTER_SIZE; j++)
    {
      if (temp[j] < temp[i])
      {
        float t = temp[i];
        temp[i] = temp[j];
        temp[j] = t;
      }
    }
  }

  return temp[PIEZO_FILTER_SIZE / 2];
}
//=======================
// ULTRASON : DISTANCE (cm)
//=======================
float readDistanceCM()
{
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // timeout 30ms
  if (duration == 0) return TANK_HEIGHT; // pas d'echo = considere plein/vide selon montage

  float distance = duration * 0.0343 / 2.0;
  return distance;
}
//=======================
// SETUP
//=======================
void setup()
{
  Serial.begin(115200);
  // WiFi + MQTT
  setup_wifi();
  mqtt.setServer(mqtt_server, mqtt_port);
  // DHT11
  dht.begin();
  // ADS1115 : initialisation explicite du bus I2C (obligatoire sur ESP32
  // avant d'appeler ads.begin(), sinon le module n'est pas detecte)
  Wire.begin(21, 22); // SDA=21, SCL=22 -> adaptez si votre cablage est different

  // Adresse par defaut 0x48 (broche ADDR reliee a GND). Changez si besoin :
  // 0x48 = ADDR->GND, 0x49 = ADDR->VDD, 0x4A = ADDR->SDA, 0x4B = ADDR->SCL
  if (!ads.begin(0x48))
  {
    Serial.println("Erreur : ADS1115 non detecte");
    while (1) { delay(1000); } // bloque ici pour eviter de faire tourner le reste sans capteur
  }
  Serial.println("ADS1115 OK");
  // gain et vitesse d'echantillonnage adaptes au piezo
  ads.setGain(GAIN_ONE);               // +/-4.096V, resolution ~0.125mV/bit
  ads.setDataRate(RATE_ADS1115_860SPS); // le plus rapide dispo, pour coller aux 500us
  // I2S microphone
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = 16000,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = (i2s_comm_format_t)(I2S_COMM_FORMAT_STAND_I2S),
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 4,
    .dma_buf_len = I2S_SAMPLES,
    .use_apll = false
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_BCLK,
    .ws_io_num = I2S_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = I2S_SD
  };

  i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_PORT, &pin_config);
  // Ultrason
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  // Debitmetre
  pinMode(FLOW_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), flowPulseISR, FALLING);

  previousTime = millis();
}

void loop()
{
  if (!mqtt.connected())
  {
    reconnectMQTT();
  }
  mqtt.loop();

  // --- Temperature / Humidite ---
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  if (isnan(temperature) || isnan(humidity))
  {
    temperature = -1;
    humidity = -1;
  }
  // --- Piezo (calibre 0-200 repos / >200 vibration) ---
  float piezoRaw = readPiezoRMS();
  float piezoFiltered = medianPiezoFilter(piezoRaw);
  // --- Voltage (tension mesuree sur meme canal ADS1115, exemple) ---
  int16_t adcVal = ads.readADC_SingleEnded(1);
  float voltage = ads.computeVolts(adcVal);
  // --- Microphone ---
  float micRMS = 0;
  readMic(micRaw, micRMS);
  // --- Distance / Debit / Pression ---
  float distance = readDistanceCM();
  // Calcul du debit a partir des pulses (sur 1 seconde)
  unsigned long currentTime = millis();
  float debit = 0;
  if (currentTime - previousTime >= 1000)
  {
    noInterrupts();
    unsigned long pulses = pulseCount;
    pulseCount = 0;
    interrupts();
    debit = pulses / FLOW_CALIBRATION_FACTOR; // L/min
    previousTime = currentTime;
  }
  // Pression estimee a partir de la hauteur d'eau 
  float waterHeight = TANK_HEIGHT - distance;
  if (waterHeight < 0) waterHeight = 0;
  float pression = waterHeight * 10.0; // facteur a adapter a votre capteur reel
  // --- Construction du JSON ---
  StaticJsonDocument<300> doc;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["piezo_raw"] = piezoFiltered;
  doc["voltage"] = voltage;
  doc["microphone_rms"] = micRMS;
  doc["distance"] = distance;
  doc["debit"] = debit;
  doc["pression"] = pression;
  char buffer[300];
  size_t n = serializeJson(doc, buffer);

  mqtt.publish(mqtt_topic, buffer, n);
  Serial.println(buffer);

  delay(200);
}
