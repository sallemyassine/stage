<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use PhpMqtt\Client\MqttClient;

class MqttSubscriber extends Command
{
    protected $signature = 'app:mqtt-subscriber';

    protected $description = 'MQTT Subscriber (écoute/diagnostic uniquement)';

    public function handle()
    {
        $server = env('MQTT_HOST', '127.0.0.1');
        $port = env('MQTT_PORT', 1883);
        $clientId = env('MQTT_CLIENT_ID', 'laravel_subscriber');
        $mqtt = new MqttClient($server, $port, $clientId);

        $mqtt->connect();

        $this->info("Connected to MQTT broker");

        $mqtt->subscribe('esp32/capteurs', function ($topic, $message) {

            $this->info("Message: " . $message);

            $data = json_decode($message, true);

            if (!$data) {
                $this->error("Invalid JSON");
                return;
            }

            // ATTENTION : cette commande n'écrit plus en base.
            //
            // Le script Python (paho-mqtt) est déjà abonné au même topic
            // "esp32/capteurs". Il calcule l'état de la pompe (IA), le
            // health_score et la cause d'anomalie, puis envoie TOUT ça
            // en une seule requête à l'API Laravel (SensorDataController::store).
            //
            // Si CETTE commande insère aussi une ligne via SensorData::create(),
            // on obtient DEUX lignes par mesure ESP32 : une complète (Python,
            // avec label/anomaly_type/health_score) et une incomplète (ici,
            // avec label/anomaly_type/health_score toujours vides/à 0).
            //
            // Comme le dashboard Angular lit systématiquement la DERNIÈRE ligne
            // (SensorData::latest()), il alterne alors entre les deux sources
            // selon l'ordre d'arrivée des insertions -> c'est exactement ce qui
            // causait l'alternance "health_score réel / 0%" observée.
            //
            // => Un seul composant doit écrire en base. Tant que Python gère
            // l'ingestion complète (capteurs + IA) via l'API HTTP, cette
            // commande ne doit PAS appeler SensorData::create().
            //
            // Si tu as besoin de cette commande pour autre chose (debug,
            // supervision, republication vers un autre topic...), garde-la
            // pour l'écoute/log uniquement, comme ci-dessus.

            $this->info("Message reçu (non inséré en base — géré par le script Python)");

        }, 0);

        $mqtt->loop(true);
    }
}