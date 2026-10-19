<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use PhpMqtt\Client\MqttClient;
use PhpMqtt\Client\ConnectionSettings;

class MqttSubscribe extends Command
{
    protected $signature = 'mqtt:subscribe';

    protected $description = 'Subscribe to MQTT sensor data';

    public function handle()
    {
        $mqtt = new MqttClient(
            '10.1.60.231', // IP du broker MQTT
            1883,
            'laravel-subscriber'
        );

        $settings = (new ConnectionSettings)
            ->setKeepAliveInterval(60);

        $mqtt->connect($settings);

        $this->info("Connected to MQTT broker");

        $mqtt->subscribe('esp32/capteurs', function ($topic, $message) {

            $data = json_decode($message, true);

            DB::table('pump_monitoring')->insert([
                'temperature' => $data['temperature'],
                'humidity' => $data['humidity'],
                'piezo_raw' => $data['piezo_raw'],
                'piezo_voltage' => $data['piezo_voltage'],
                'voltage' => $data['voltage'],
                'microphone' => $data['microphone'],
                'distance' => $data['distance'],
            ]);

            echo "Data saved\n";
        }, 0);

        $mqtt->loop(true);
    }
}