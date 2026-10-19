import { Component, OnInit, AfterViewInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SensorService } from '../services/sensor';
import { interval, startWith, switchMap } from 'rxjs';
import Chart from 'chart.js/auto';
import { PumpViewer } from '../pump-viewer/pump-viewer';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule ,
    PumpViewer
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})

export class Dashboard implements OnInit, AfterViewInit {
  private readonly MAX_POINTS = 200;
// ==================================================
  // Getters pour piloter le viewer 3D de la pompe (Three.js)
  // ==================================================

  get pumpStatus(): 'ok' | 'fault' {
    return this.latestData.label === 'fault' ? 'fault' : 'ok';
  }

  get pumpIsRunning(): boolean {
    return (this.latestData.debit ?? 0) > 0;
  }

  @ViewChild('vibrationCanvas')
  vibrationCanvasRef!: ElementRef<HTMLCanvasElement>;

  @ViewChild('voltageCanvas')
  voltageCanvasRef!: ElementRef<HTMLCanvasElement>;

  @ViewChild('soundCanvas')
  soundCanvasRef!: ElementRef<HTMLCanvasElement>;



  latestData:any = {

    temperature:0,
    humidity:0,
    vibration_rms:0,
    voltage:0,
    microphone_rms:0,
    distance:0,
    debit:0,
    pression:0,

    label:"",
    anomaly_type:"",
    health_score:0
  };



  labels:string[]=[];


  vibrationData:number[]=[];
  voltageData:number[]=[];
  soundData:number[]=[];


  vibrationChart?:Chart;
  voltageChart?:Chart;
  soundChart?:Chart;


  chartsReady=false;


  isLoadingHistory=true;
  historyError=false;


  // =====================================================
  // Configuration des jauges à aiguille
  // (min / max servent uniquement à positionner l'aiguille)
  // =====================================================

  readonly gaugesConfig: { key:string; label:string; unit:string; min:number; max:number }[] = [

    { key:'temperature',    label:'Température',      unit:'°C',    min:0, max:60  },
    { key:'humidity',       label:'Humidité',         unit:'%',     min:0, max:100 },
    { key:'distance',       label:'Distance (cm)',    unit:'cm',    min:0, max:18 },
    { key:'debit',          label:'Débit L/min',      unit:'L/min', min:0, max:8 },
    { key:'pression',       label:'Pression',         unit:'bar',   min:0, max:4000 },
    { key:'voltage',        label:'Voltage',          unit:'V',     min:-1, max:5 },
    { key:'vibration_rms',  label:'Vibration RMS',    unit:'',      min:-10000, max:10000 },
    { key:'microphone_rms', label:'Microphone RMS',   unit:'',      min:-10000, max:50000 }

  ];


  // Rayon utilisé dans le SVG de l'anneau "Health Score" (voir dashboard.html)
  readonly healthRadius = 68;
  readonly healthCircumference = 2 * Math.PI * this.healthRadius;



  constructor(
    private sensorService:SensorService,
    private cd:ChangeDetectorRef
  ){}



  // =====================================================
  // Initialisation
  // =====================================================

  ngOnInit():void{


    this.sensorService.getHistory()
    .subscribe({

      next:(rows:any[])=>{


        if(Array.isArray(rows)){


          rows.forEach(row=>{

            this.pushDataPoint(
              row,
              row.created_at ?
              new Date(row.created_at):
              undefined
            );

          });


        }



        this.isLoadingHistory=false;


        if(this.chartsReady){

          this.updateCharts();

        }


        this.cd.detectChanges();


        this.startRealtimePolling();



      },


      error:(err)=>{

        console.error(
          "History error",
          err
        );


        this.historyError=true;

        this.isLoadingHistory=false;


        this.startRealtimePolling();

      }


    });



  }




  // =====================================================
  // Initialisation des graphiques une fois la vue prête
  // (méthode manquante dans la version précédente : elle était
  // déclarée via "implements AfterViewInit" mais jamais définie,
  // donc createCharts() n'était jamais appelé et chartsReady
  // restait à false pour toujours)
  // =====================================================

  ngAfterViewInit(): void {

    this.createCharts();

    this.chartsReady = true;

    // Si l'historique est déjà arrivé avant que la vue soit prête,
    // on met à jour les graphiques immédiatement avec les données reçues
    if (!this.isLoadingHistory) {

      this.updateCharts();

    }

    this.cd.detectChanges();

  }




  // =====================================================
  // Temps réel toutes les 2 secondes
  // =====================================================

  private startRealtimePolling(){


    interval(2000)

    .pipe(

      startWith(0),

      switchMap(()=>this.sensorService.getLatestData())

    )

    .subscribe({

      next:(data:any)=>{


        this.pushDataPoint(data);



        if(this.chartsReady){

          this.updateCharts();

        }


        this.cd.detectChanges();


      },


      error:(err)=>{

        console.error(
          "API ERROR",
          err
        );

      }


    });


  }




  // =====================================================
  // Ajouter une mesure
  // =====================================================
private pushDataPoint(data: any, at?: Date) {

  this.latestData = {

    temperature: data.temperature ?? 0,
    humidity: data.humidity ?? 0,
    vibration_rms: data.vibration_rms ?? 0,
    voltage: data.voltage ?? 0,
    microphone_rms: data.microphone_rms ?? 0,
    distance: data.distance ?? 0,
    debit: data.debit ?? 0,
    pression: data.pression ?? 0,

    label: data.label ?? "",
    anomaly_type: data.anomaly_type ?? "",
    health_score: data.health_score ?? 0

  };

  this.labels.push((at ?? new Date()).toLocaleTimeString());

  this.vibrationData.push(this.latestData.vibration_rms);
  this.voltageData.push(this.latestData.voltage);
  this.soundData.push(this.latestData.microphone_rms);

  // Garder seulement les 200 dernières mesures
  if (this.labels.length > this.MAX_POINTS) {
    this.labels.shift();
    this.vibrationData.shift();
    this.voltageData.shift();
    this.soundData.shift();
  }
}




  createCharts(){



    this.vibrationChart=new Chart(

      this.vibrationCanvasRef.nativeElement,

      {

        type:'line',

        data:{

          labels:this.labels,

          datasets:[{

            label:'Vibration RMS',

            data:this.vibrationData,

            borderColor:'#2563eb',

            tension:0.3,

            pointRadius:0

          }]

        },


        options:{

          // "parsing: false" et "normalized: true" ont été retirés :
          // ces options supposent que les données sont déjà au format
          // {x, y}, alors qu'ici on pousse un tableau de nombres bruts.
          // Chart.js plantait dès la première mise à jour temps réel
          // (chart.update()) en tentant de lire .x/.y sur des nombres.
          responsive: false,
          animation: false

        }


      }


    );





    this.voltageChart=new Chart(

      this.voltageCanvasRef.nativeElement,

      {

        type:'line',

        data:{

          labels:this.labels,

          datasets:[{

            label:'Voltage',

            data:this.voltageData,

            borderColor:'#f59e0b',

            tension:0.3,

            pointRadius:0

          }]

        },


        options:{

          responsive:false,

          animation:false

        }

      }

    );







    this.soundChart=new Chart(

      this.soundCanvasRef.nativeElement,

      {

        type:'line',

        data:{

          labels:this.labels,

          datasets:[{

            label:'Microphone RMS',

            data:this.soundData,

            borderColor:'#10b981',

            tension:0.3,

            pointRadius:0

          }]

        },


        options:{

          responsive:false,

          animation:false

        }


      }


    );


  }





  // =====================================================
  // Mise à jour graphiques
  // =====================================================
updateCharts() {

  if (!this.vibrationChart || !this.voltageChart || !this.soundChart) {
    return;
  }

  this.vibrationChart.update('none');
  this.voltageChart.update('none');
  this.soundChart.update('none');

}

  // =====================================================
  // Jauges à aiguille (helpers utilisés par dashboard.html)
  // =====================================================

  getGaugeValue(key:string):number{

    const v = this.latestData[key];

    return typeof v === 'number' ? v : 0;

  }


  getGaugePercent(key:string, min:number, max:number):number{

    const value = this.getGaugeValue(key);

    const clamped = Math.max(min, Math.min(max, value));

    return (clamped - min) / (max - min);

  }


  // Chemin SVG de l'arc de progression (remplace les couleurs rouge/jaune/vert
  // par un seul arc plein qui avance selon la valeur).
  getProgressPath(key:string, min:number, max:number):string{

    const percent = this.getGaugePercent(key, min, max);

    const angleDeg = 180 - percent * 180;

    const rad = angleDeg * Math.PI / 180;

    const x = 100 + 80 * Math.cos(rad);

    const y = 100 - 80 * Math.sin(rad);

    return `M20,100 A80,80 0 0,1 ${x.toFixed(2)},${y.toFixed(2)}`;

  }


  // Retourne l'angle de rotation de l'aiguille : -90° (min) -> +90° (max)
  getNeedleAngle(key:string, min:number, max:number):number{

    return -90 + this.getGaugePercent(key, min, max) * 180;

  }


  // Valeur affichée sur l'échelle graduée (min / milieu / max) de la jauge.
  // frac = 0 -> min, 0.5 -> milieu, 1 -> max
  getTickLabel(min:number, max:number, frac:number):string{

    const value = min + frac * (max - min);

    if(Math.abs(value) >= 100){

      return Math.round(value).toString();

    }

    if(Math.abs(value) >= 10){

      return value.toFixed(0);

    }

    return (Math.round(value * 10) / 10).toString();

  }


  // Retourne le stroke-dashoffset de l'anneau Health Score.
  // L'anneau n'est complet (offset = 0) que lorsque health_score = 100%.
  getHealthOffset():number{

    const percent = Math.max(0, Math.min(100, this.latestData.health_score)) / 100;

    return this.healthCircumference * (1 - percent);

  }




  // =====================================================
  // Reset
  // =====================================================

  resetData(){


    this.labels=[];

    this.vibrationData=[];

    this.voltageData=[];

    this.soundData=[];



    this.latestData={

      temperature:0,
      humidity:0,
      vibration_rms:0,
      voltage:0,
      microphone_rms:0,
      distance:0,
      debit:0,
      pression:0,

      label:"",
      anomaly_type:"",
      health_score:0

    };



    if(this.vibrationChart){

      this.vibrationChart.data.labels=[];

      this.vibrationChart.data.datasets[0].data=[];

      this.vibrationChart.update();

    }




    if(this.voltageChart){

      this.voltageChart.data.labels=[];

      this.voltageChart.data.datasets[0].data=[];

      this.voltageChart.update();

    }





    if(this.soundChart){

      this.soundChart.data.labels=[];

      this.soundChart.data.datasets[0].data=[];

      this.soundChart.update();

    }



    console.log(
      "Reset effectué"
    );
    


  }



}