<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pump_monitoring', function (Blueprint $table) {
            // On ne supprime que les colonnes qui existent reellement,
            // au cas ou certaines n'auraient pas ete creees chez toi.
            $columnsToDrop = array_filter([
                'piezo_voltage',
                'piezo_baseline',
                'voltage_baseline',
                'microphone_raw_baseline',
                'microphone_rms_baseline',
                'health_score',
            ], fn ($column) => Schema::hasColumn('pump_monitoring', $column));

            if (!empty($columnsToDrop)) {
                $table->dropColumn($columnsToDrop);
            }
        });
    }

    public function down(): void
    {
        Schema::table('pump_monitoring', function (Blueprint $table) {
            if (!Schema::hasColumn('pump_monitoring', 'piezo_voltage')) {
                $table->float('piezo_voltage')->nullable();
            }
            if (!Schema::hasColumn('pump_monitoring', 'piezo_baseline')) {
                $table->integer('piezo_baseline')->nullable();
            }
            if (!Schema::hasColumn('pump_monitoring', 'voltage_baseline')) {
                $table->float('voltage_baseline')->nullable();
            }
            if (!Schema::hasColumn('pump_monitoring', 'microphone_raw_baseline')) {
                $table->integer('microphone_raw_baseline')->nullable();
            }
            if (!Schema::hasColumn('pump_monitoring', 'microphone_rms_baseline')) {
                $table->float('microphone_rms_baseline')->nullable();
            }
            if (!Schema::hasColumn('pump_monitoring', 'health_score')) {
                $table->float('health_score')->nullable();
            }
        });
    }
};
