import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  Input,
  OnChanges,
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
  @ViewChild('canvasContainer', { static: true }) containerRef!: ElementRef<HTMLDivElement>;

  @Input() status: 'ok' | 'fault' = 'ok';
  @Input() vibrating = false;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private bodyMesh: THREE.Mesh | null = null;
  private pumpRoot: THREE.Object3D | null = null;
  private animationFrameId = 0;
  private resizeObserver!: ResizeObserver;

  ngAfterViewInit(): void {
    this.initScene();
    this.loadPumpModel();
    this.animate();
    this.observeResize();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['status'] && this.bodyMesh) {
      this.updateStatusColor();
    }
  }

  private initScene(): void {
    const container = this.containerRef.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight || 400;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f0f0);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 100);
    this.camera.position.set(0.15, 0.1, 0.2);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(1, 1, 1);
    this.scene.add(directional);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0.03, 0);
  }

  private loadPumpModel(): void {
    const loader = new GLTFLoader();
    loader.load(
      'assets/pump.glb',
      (gltf) => {
        this.pumpRoot = gltf.scene;
        this.scene.add(this.pumpRoot);
        this.bodyMesh = this.pumpRoot.getObjectByName('Body') as THREE.Mesh;
        this.updateStatusColor();
      },
      undefined,
      (error) => console.error('Erreur chargement pump.glb :', error)
    );
  }

  private updateStatusColor(): void {
    if (!this.bodyMesh) return;
    const material = this.bodyMesh.material as THREE.MeshStandardMaterial;
    material.color.set(this.status === 'fault' ? 0xff2222 : 0x22aa22);
  }

  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    if (this.pumpRoot && this.vibrating) {
      const t = performance.now() * 0.02;
      this.pumpRoot.position.y = Math.sin(t) * 0.001;
    } else if (this.pumpRoot) {
      this.pumpRoot.position.y = 0;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private observeResize(): void {
    const container = this.containerRef.nativeElement;
    this.resizeObserver = new ResizeObserver(() => {
      const width = container.clientWidth;
      const height = container.clientHeight || 400;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    });
    this.resizeObserver.observe(container);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationFrameId);
    this.resizeObserver?.disconnect();
    this.renderer?.dispose();
  }
}