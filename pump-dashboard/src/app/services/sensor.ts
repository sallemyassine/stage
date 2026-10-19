import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class SensorService {


  private baseUrl = 'http://my-backend.test/api/sensor-data';

  private apiUrl = `${this.baseUrl}/latest`;

  private historyUrl = `${this.baseUrl}/history`;



  constructor(
    private http: HttpClient
  ) {}



  // Dernière mesure (temps réel)
  getLatestData(): Observable<any> {

    return this.http.get<any>(this.apiUrl)

    .pipe(

      catchError(error => {

        console.error(
          'Erreur API latest :',
          error
        );

        return throwError(
          () => error
        );

      })

    );

  }





  // Historique complet pour les courbes
  getHistory(): Observable<any[]> {


    return this.http.get<any[]>(this.historyUrl)

    .pipe(

      catchError(error => {

        console.error(
          'Erreur API historique :',
          error
        );


        return throwError(
          () => error
        );


      })

    );


  }





  // Récupérer une mesure par ID
  // utile pour vérifier le résultat IA

  getDataById(id:number): Observable<any> {


    return this.http.get<any>(
      `${this.baseUrl}/${id}`
    )

    .pipe(

      catchError(error => {


        console.error(
          'Erreur API ID :',
          error
        );


        return throwError(
          () => error
        );


      })

    );


  }


}