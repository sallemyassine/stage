# ==================================================
# 1) Import des bibliothèques
# ==================================================

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.metrics import classification_report
from sklearn.metrics import confusion_matrix
import paho.mqtt.client as mqtt
import json
import pandas as pd
import joblib

# ==================================================
# 2) Charger CSV
# ==================================================

df_original = pd.read_csv("pump_monitoring (7).csv")
print(df_original.head())
print("\nEtat pompe :")
print(df_original["label"].value_counts())

# ==================================================
# PARTIE 1 : MODELE LABEL
# normal / warning / fault
# ==================================================
df = df_original.copy()
df = df.drop(
["id","created_at","updated_at","anomaly_type","health_score"],axis=1)
# Encoder label
encoder = LabelEncoder()
df["label"] = encoder.fit_transform(df["label"])
X = df.drop("label",axis=1)
y = df["label"]
# Normalisation
scaler = StandardScaler()
X = scaler.fit_transform(X)
# Train test
X_train, X_test, y_train, y_test = train_test_split(X,y,test_size=0.2,random_state=42,stratify=y)
# Création modèle état
model = RandomForestClassifier(n_estimators=200,random_state=42)
print("\nApprentissage modèle état...")
model.fit(X_train,y_train)
print("Terminé")
# Test
prediction = model.predict(X_test)
print("\nPrécision label :")
print(f"{accuracy_score(y_test, prediction) * 100:.2f} %")

print("\nRapport de classification :")
print(classification_report(
    y_test,
    prediction,
    target_names=encoder.classes_
))

cm_label = confusion_matrix(y_test, prediction)

cm_label_df = pd.DataFrame(
    cm_label,
    index=encoder.classes_,
    columns=encoder.classes_
)

print("\nMatrice de confusion (Label) :")
print(cm_label_df)
print("\nPrécision label :")
print(accuracy_score(y_test,prediction)*100,"%")
# ==================================================
# PARTIE 2 : MODELE CAUSE ANOMALIE
# AJOUT
# ==================================================
df2 = df_original.copy()
# Supprimer ce qui ne sert pas
df2 = df2.drop(["id","created_at","updated_at","label","health_score"],axis=1)
# Encoder anomaly_type
encoder_cause = LabelEncoder()
df2["anomaly_type"] = encoder_cause.fit_transform(df2["anomaly_type"])
X2 = df2.drop("anomaly_type",axis=1)
y2 = df2["anomaly_type"]
# Normalisation
scaler_cause = StandardScaler()
X2 = scaler_cause.fit_transform(X2)
# Séparation
X2_train, X2_test, y2_train, y2_test = train_test_split(X2,y2,test_size=0.2,random_state=42,stratify=y2)
# Modèle cause
model_cause = RandomForestClassifier(n_estimators=200,random_state=42)
print("\nApprentissage modèle cause...")
model_cause.fit(X2_train,y2_train)
print("Modèle cause terminé")
# Test cause
pred_cause = model_cause.predict(X2_test)
# ==================================================
# Test modèle cause
# ==================================================

pred_cause = model_cause.predict(X2_test)

print("\nPrécision cause :")
print(f"{accuracy_score(y2_test, pred_cause) * 100:.2f} %")

print("\nRapport de classification :")
print(classification_report(
    y2_test,
    pred_cause,
    target_names=encoder_cause.classes_
))

# ==================================================
# Matrice de confusion
# ==================================================

cm = confusion_matrix(y2_test, pred_cause)

cm_df = pd.DataFrame(
    cm,
    index=encoder_cause.classes_,
    columns=encoder_cause.classes_
)

print("\nMatrice de confusion :")
print(cm_df)
print("\nPrécision cause :")
print(accuracy_score(y2_test,pred_cause)*100,"%")
print(classification_report(y2_test,pred_cause,target_names=encoder_cause.classes_))
# ==================================================
# Sauvegarde des modèles
# ==================================================
joblib.dump(model,"pump_model.pkl")
joblib.dump(scaler,"scaler.pkl")
joblib.dump(encoder,"encoder.pkl")
# modèle cause
joblib.dump(model_cause,"cause_model.pkl")
joblib.dump(scaler_cause,"cause_scaler.pkl")
joblib.dump(encoder_cause,"cause_encoder.pkl")
print("\nTous les modèles sauvegardés !")

