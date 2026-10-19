<?php
 
namespace App\Models;
 
use Illuminate\Database\Eloquent\Model;
 
class SensorData extends Model
{
    protected $table = 'pump_monitoring';
 
    protected $fillable = [
        'temperature',
        'humidity',
        'vibration_rms',
        'voltage',
        'microphone_rms',
        'distance',
        'debit',
        'pression',
        'label',
        'anomaly_type',
        'health_score'
    ];
}
 