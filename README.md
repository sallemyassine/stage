# Système Intelligent de Supervision d'une Pompe à Eau

**IoT | Machine Learning | Laravel | Angular | Digital Twin 3D**

## Présentation

Développement d'un système intelligent de supervision d'une pompe à eau sur une maquette hydraulique didactique.
Le projet combine l'acquisition de données par ESP32, la communication MQTT, la détection des anomalies par Machine Learning et une interface web intégrant un jumeau numérique 3D pour visualiser l'état de fonctionnement de la pompe.

## Technologies utilisées

- **Embarqué :** ESP32, Arduino, C++
- **Communication :** MQTT, Mosquitto
- **Intelligence artificielle :** Python, Scikit-learn, Random Forest
- **Backend :** PHP, Laravel, API REST
- **Frontend :** Angular, TypeScript
- **Base de données :** MySQL
- **Digital Twin :** Blender, Three.js

## Architecture

ESP32 & Sensors
      |
      v
  MQTT Broker
      |
      v
 Python / ML
      |
      v
 Laravel API
      |
      v
  MySQL
      |
      v
Angular Dashboard
      |
      v
 Digital Twin 3D

## Fonctionnalités principales

- Acquisition et supervision des données des capteurs.
- Détection et classification des anomalies.
- Évaluation de l'état de santé de la pompe (Health Score).
- Visualisation des données et de l'état de fonctionnement en temps réel.
- Représentation interactive de la pompe en 3D.

## Structure du projet

.
├── arduinov/               # Firmware ESP32
├── ia/                     # Modèles et scripts ML
├── my-backend/             # Backend Laravel
├── pump-dashboard/         # Application Angular
├── generate_pump_blender.py
└── README.md

## Réalisé par

**Yassine Sallem & Rahma Trabelsi**

Institut Supérieur d'Informatique et de Multimédia de Sfax (ISIMS).
