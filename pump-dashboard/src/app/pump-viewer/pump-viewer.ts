import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  OnChanges,
  Input,
  SimpleChanges,
} from '@angular/core';

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

@Component({
  selector: 'app-pump-viewer',
  standalone: true,
  templateUrl: './pump-viewer.html',
  styleUrls: ['./pump-viewer.css'],
})
export class PumpViewer implements AfterViewInit, OnDestroy, OnChanges {

  @ViewChild('canvasContainer', { static: true })
  containerRef!: ElementRef<HTMLDivElement>;

  @Input() status: 'ok' | 'fault' = 'ok';
  @Input() vibrating = false;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;

  private pumpRoot: THREE.Object3D | null = null;
  private bodyMesh: THREE.Mesh | null = null;

  private animationFrameId = 0;
  private resizeObserver?: ResizeObserver;   // AJOUT

  ngAfterViewInit(): void {
    this.initScene();
    this.loadPump();
    this.animate();

    // AJOUT : observe le conteneur réel plutôt que la fenêtre.
    // Corrige le cas où le layout (flex/grid) n'a pas encore sa taille
    // finale au moment du ngAfterViewInit, et gère aussi les
    // redimensionnements ultérieurs (fenêtre, sidebar, etc.)
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.containerRef.nativeElement);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['status']) {
      this.updatePumpColor();
    }
  }

  private initScene(): void {
    const container = this.containerRef.nativeElement;

    // AJOUT : fallback robuste si le conteneur n'a pas encore de taille
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf5f5f5);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 100);
    this.camera.position.set(2, 1.5, 2);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(width, height);

    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this.scene.add(new THREE.AxesHelper(0.5));
    this.scene.add(new THREE.GridHelper(2, 20));

    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 2);
    dir.position.set(3, 3, 2);
    this.scene.add(dir);
  }

  // AJOUT : recalcule caméra + renderer sur la taille RÉELLE et ACTUELLE du conteneur
  private onResize(): void {
    if (!this.renderer || !this.camera) return;

    const container = this.containerRef.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private loadPump(): void {
    const loader = new GLTFLoader();

    loader.load(
      '/assets/pump.glb',
      (gltf) => {
        this.pumpRoot = gltf.scene;
        this.scene.add(this.pumpRoot);

        const box = new THREE.Box3().setFromObject(this.pumpRoot);
        const center = box.getCenter(new THREE.Vector3());
        this.pumpRoot.position.sub(center);

        const size = box.getSize(new THREE.Vector3()).length();
        const distance = size * 1.5;

        this.camera.position.set(distance, distance * 0.8, distance);
        this.controls.target.set(0, 0, 0);
        this.controls.update();

        this.bodyMesh = this.pumpRoot.getObjectByName('Body') as THREE.Mesh;
        this.updatePumpColor();

        // AJOUT : une fois le modèle chargé, on force un recalcul de taille
        // (utile si le conteneur a fini de se stabiliser entre-temps)
        this.onResize();

        console.log('Pompe chargée.');
      },
      undefined,
      (err) => {
        console.error('Erreur GLB :', err);
      }
    );
  }

  private updatePumpColor(): void {
    if (!this.bodyMesh) return;
    const material = this.bodyMesh.material as THREE.MeshStandardMaterial;
    material.color.set(this.status === 'fault' ? 0xff0000 : 0x22aa22);
  }

  private animate = () => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    if (this.pumpRoot) {
      if (this.vibrating) {
        const t = performance.now() * 0.02;
        this.pumpRoot.position.y = Math.sin(t) * 0.003;
      } else {
        this.pumpRoot.position.y = 0;
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationFrameId);
    this.resizeObserver?.disconnect();   // AJOUT : nettoyage
    this.renderer.dispose();
  }
}