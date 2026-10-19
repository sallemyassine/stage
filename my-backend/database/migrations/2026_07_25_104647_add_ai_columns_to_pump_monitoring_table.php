<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
{
    Schema::table('pump_monitoring', function (Blueprint $table) {

        $table->float('health_score')->nullable();

    });
}


public function down()
{
    Schema::table('pump_monitoring', function (Blueprint $table) {

        $table->dropColumn([
            'health_score'
        ]);

    });
}
    
};
