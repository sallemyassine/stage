<?php

namespace App\Http\Controllers;

use App\Models\SensorData;
use Illuminate\Http\Request;

class SensorDataController extends Controller
{

    // =====================================================
    // Enregistrer une nouvelle mesure capteurs + résultat IA
    // (une seule requête, une seule ligne complète dès la création :
    // plus de fenêtre où health_score/label sont vides en base)
    // =====================================================
    public function store(Request $request)
    {

        $validated = $request->validate([

            'temperature'    => 'required|numeric',
            'humidity'       => 'required|numeric',
            'vibration_rms'  => 'required|numeric',
            'voltage'        => 'required|numeric',
            'microphone_rms' => 'required|numeric',
            'distance'       => 'required|numeric',
            'debit'          => 'required|numeric',
            'pression'       => 'required|numeric',

            'label'          => 'required|string',
            'anomaly_type'   => 'required|string',
            'health_score'   => 'required|numeric',

        ]);


        $data = SensorData::create($validated);


        return response()->json([

            'success'=>true,

            'id'=>$data->id,

            'data'=>$data

        ]);

    }



    // =====================================================
    // Dernière mesure
    // =====================================================
    public function latest()
    {

        $data = SensorData::latest()->first();


        if(!$data){

            return response()->json([

                'id'=>null,

                'temperature'=>0,
                'humidity'=>0,
                'vibration_rms'=>0,
                'voltage'=>0,
                'microphone_rms'=>0,
                'distance'=>0,
                'debit'=>0,
                'pression'=>0,

                'label'=>'',
                'anomaly_type'=>'',
                'health_score'=>0,

                'created_at'=>null,
                'updated_at'=>null

            ]);

        }


        return response()->json($data);

    }





    // =====================================================
    // Historique
    // =====================================================
    public function history(Request $request)
    {


        if($request->has('limit')){


            $limit=(int)$request->limit;


            $data = SensorData::latest()

                ->take($limit)

                ->get()

                ->reverse()

                ->values();


        }else{


            $data = SensorData::orderBy(
                'created_at',
                'asc'
            )->get();


        }


        return response()->json($data);

    }





    // =====================================================
    // Recherche par ID
    // =====================================================
    public function show($id)
    {

        return response()->json(

            SensorData::findOrFail($id)

        );

    }


}