import pandas as pd
import json
import paho.mqtt.client as mqtt
import joblib
import requests

BROKER = "10.1.60.70"
PORT = 1883
TOPIC = "esp32/capteurs"

# Un seul endpoint : on envoie mesure + résultats IA en même temps,
# donc plus jamais de ligne "incomplète" visible par le dashboard.
API_SENSOR_FULL = "http://my-backend.test/api/sensor-data"


# ===============================
# Chargement modèles IA
# ===============================

model = joblib.load("pump_model.pkl")
scaler = joblib.load("scaler.pkl")
encoder = joblib.load("encoder.pkl")

model_cause = joblib.load("cause_model.pkl")
scaler_cause = joblib.load("cause_scaler.pkl")
encoder_cause = joblib.load("cause_encoder.pkl")

print("Modèles chargés avec succès")



def on_message(client, userdata, msg):

    print("\nDonnée MQTT reçue")

    try:

        data = json.loads(msg.payload.decode())

        print(data)


        # ===============================
        # 1 - DataFrame IA (avant tout envoi)
        # ===============================

        sensor_data = {

            "temperature": data.get("temperature", 0),
            "humidity": data.get("humidity", 0),
            "vibration_rms": data.get("vibration_rms", 0),
            "voltage": data.get("voltage", 0),
            "microphone_rms": data.get("microphone_rms", 0),
            "distance": data.get("distance", 0),
            "debit": data.get("debit", 0),
            "pression": data.get("pression", 0)

        }

        nouvelle_mesure = pd.DataFrame([sensor_data])



        # ===============================
        # 2 - Etat pompe
        # ===============================

        mesure1 = scaler.transform(nouvelle_mesure)

        resultat = model.predict(mesure1)

        etat = encoder.inverse_transform(resultat)



        # ===============================
        # 3 - Health Score
        # ===============================

        proba = model.predict_proba(mesure1)[0]

        classes = encoder.classes_

        score = 0


        for classe, probabilite in zip(classes, proba):

            if classe == "normal":

                score += probabilite * 100


            elif classe == "warning":

                score += probabilite * 60


            elif classe == "fault":

                score += probabilite * 10



        health_score = max(0, min(100, score))



        # ===============================
        # 4 - Cause anomalie
        # ===============================

        mesure2 = scaler_cause.transform(nouvelle_mesure)

        resultat_cause = model_cause.predict(mesure2)

        cause = encoder_cause.inverse_transform(resultat_cause)



        print("\n================")
        print("Etat :", etat[0])
        print("Cause :", cause[0])
        print("Health :", round(health_score, 1), "%")
        print("================")



        # ===============================
        # 5 - Envoyer mesure + IA en UNE SEULE requête
        # (plus de fenêtre où la ligne existe sans ses valeurs IA)
        # ===============================

        payload = {

            **sensor_data,

            "label": etat[0],

            "anomaly_type": cause[0],

            "health_score": round(health_score, 1)

        }


        response = requests.post(
            API_SENSOR_FULL,
            json=payload
        )


        if response.status_code in [200, 201]:

            print("Mesure + résultat IA enregistrés, id =", response.json().get("id"))

        else:

            print("Erreur insertion :", response.text)



    except Exception as e:

        print("Erreur :", e)




# ===============================
# MQTT
# ===============================

client = mqtt.Client()

client.on_message = on_message

client.connect(
    BROKER,
    PORT
)

client.subscribe(TOPIC)


print("Attente MQTT...")


client.loop_forever()