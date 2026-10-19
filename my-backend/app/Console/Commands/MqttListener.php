<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use PhpMqtt\Client\MqttClient;
use App\Models\PumpMonitoring;


class MqttListener extends Command
{

    protected $signature = 'mqtt:listen';

    protected $description = 'Receive ESP32 MQTT data';


    public function handle()
    {

        $mqtt = new MqttClient(
            "127.0.0.1",
            1883,
            "laravel_listener"
        );


        $mqtt->connect();


        $this->info("MQTT connected");


        $mqtt->subscribe(
            "pump/data",

            function($topic,$message){

                $data=json_decode($message,true);


                PumpMonitoring::create([

                    "temperature"=>$data["temperature"],

                    "humidity"=>$data["humidity"],

                    "vibration"=>$data["vibration"],

                    "voltage"=>$data["voltage"],

                    "sound"=>$data["sound"],

                    "flow_rate"=>$data["flow_rate"]

                ]);


                echo "Data saved\n";

            }

        );


        $mqtt->loop(true);


    }

}