<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\SensorDataController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Test API
Route::get('/test', function () {
    return response()->json([
        'success' => true,
        'message' => 'API Laravel fonctionne.'
    ]);
});

// ===============================
// Données capteurs (mesure + IA en une seule requête)
// ===============================
Route::post('/sensor-data', [SensorDataController::class, 'store']);

Route::get('/sensor-data/latest', [SensorDataController::class, 'latest']);

Route::get('/sensor-data/history', [SensorDataController::class, 'history']);

Route::get('/sensor-data/{id}', [SensorDataController::class, 'show']);

// La route /sensor-ai a été retirée : elle causait une race condition
// (ligne créée sans IA, mise à jour 0.2s plus tard) responsable de
// l'alternance "health_score réel / 0%" observée sur le dashboard.