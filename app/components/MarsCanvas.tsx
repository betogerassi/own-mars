"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { MutableRefObject } from "react";
import type { Spot } from "../lib/demo";
import { pointToLatLon } from "../lib/demo";

export type MarsControls = {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  orbit: () => void;
  focus: (lat: number, lon: number) => void;
};

type Transition = { position: THREE.Vector3; target: THREE.Vector3 };

const RADIUS = 1.5;
const INITIAL_POSITION = new THREE.Vector3(0, 0, 5.25);
const MIN_DISTANCE = 1.85;
const MAX_DISTANCE = 6;

function positionFor(lat: number, lon: number, radius = RADIUS) {
  const latRadians = THREE.MathUtils.degToRad(lat);
  const lonRadians = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(
    radius * Math.cos(latRadians) * Math.cos(lonRadians),
    radius * Math.sin(latRadians),
    radius * Math.cos(latRadians) * Math.sin(lonRadians),
  );
}

function ArtworkMarker({ spot }: { spot: Spot }) {
  const [artwork, setArtwork] = useState<THREE.Texture>();
  const point = positionFor(spot.lat, spot.lon, RADIUS + 0.025);
  const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), point.clone().normalize());
  const size = THREE.MathUtils.clamp(Math.max(spot.width, spot.height) / 180, 0.16, 0.52);

  useEffect(() => {
    if (!spot.image) { setArtwork(undefined); return; }
    const loader = new THREE.TextureLoader();
    loader.load(spot.image, (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.wrapS = THREE.ClampToEdgeWrapping;
      loaded.wrapT = THREE.ClampToEdgeWrapping;
      const crop = THREE.MathUtils.clamp(spot.crop || 1, 1, 2.5);
      loaded.repeat.set(1 / crop, 1 / crop);
      loaded.offset.set((1 - 1 / crop) * (0.5 + (spot.cropX ?? 0) * 0.25), (1 - 1 / crop) * (0.5 + (spot.cropY ?? 0) * 0.25));
      loaded.needsUpdate = true;
      setArtwork(loaded);
    });
  }, [spot.crop, spot.cropX, spot.cropY, spot.image]);

  return <group position={point} quaternion={rotation}><mesh><planeGeometry args={[size, size]}/><meshBasicMaterial map={artwork} color={artwork ? "#fff" : "#ff805b"} transparent={Boolean(artwork)} side={THREE.DoubleSide}/></mesh></group>;
}

function Scene({
  selected,
  spots,
  onSelect,
  controlRef,
  interactive,
  focusOnSelection,
}: {
  selected: Spot | null;
  spots: Spot[];
  onSelect: (lat: number, lon: number) => void;
  controlRef?: MutableRefObject<MarsControls | null>;
  interactive: boolean;
  focusOnSelection: boolean;
}) {
  const controls = useRef<any>(null);
  const globe = useRef<THREE.Group>(null);
  const transition = useRef<Transition | null>(null);
  const isInteracting = useRef(false);
  const { camera } = useThree();
  const [texture, setTexture] = useState<THREE.Texture>();

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load("/mars-nasa.jpg", (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace;
      setTexture(loaded);
    });
  }, []);

  const cancelTransition = () => {
    transition.current = null;
  };

  const startTransition = (position: THREE.Vector3, target: THREE.Vector3) => {
    transition.current = { position, target };
  };

  const reset = () => {
    startTransition(INITIAL_POSITION.clone(), new THREE.Vector3());
  };

  const zoom = (factor: number) => {
    cancelTransition();
    const target = controls.current?.target ?? new THREE.Vector3();
    const offset = camera.position.clone().sub(target);
    const nextDistance = THREE.MathUtils.clamp(offset.length() * factor, MIN_DISTANCE, MAX_DISTANCE);
    if (offset.lengthSq() === 0) offset.set(0, 0, 1);
    camera.position.copy(target.clone().add(offset.normalize().multiplyScalar(nextDistance)));
    controls.current?.update();
  };

  const focus = (lat: number, lon: number) => {
    const localPoint = positionFor(lat, lon);
    // Coordinates are stored in Mars-local space. The surface can have rotated
    // since the selection, so derive a world-space camera destination from the
    // group's current transform rather than treating local values as world ones.
    const worldPoint = globe.current?.localToWorld(localPoint.clone()) ?? localPoint;
    startTransition(worldPoint.clone().normalize().multiplyScalar(2.55), worldPoint.clone().multiplyScalar(0.42));
  };

  useEffect(() => {
    if (!controlRef) return;
    controlRef.current = { zoomIn: () => zoom(0.8), zoomOut: () => zoom(1.25), reset, orbit: reset, focus };
    return () => {
      if (controlRef.current) controlRef.current = null;
    };
  }, [camera, controlRef]);

  useEffect(() => {
    if (selected && focusOnSelection) focus(selected.lat, selected.lon);
  }, [selected, focusOnSelection]);

  const selectPoint = (point: THREE.Vector3) => {
    if (!interactive || !globe.current) return;
    // Raycast positions are world-space. Mars rotates as a group, so selection
    // must be converted to the texture's local coordinate frame first.
    const coordinate = pointToLatLon(globe.current.worldToLocal(point.clone()));
    onSelect(coordinate.lat, coordinate.lon);
  };

  useFrame((_, delta) => {
    if (globe.current && !transition.current && !isInteracting.current) globe.current.rotation.y += delta * 0.09;
    const next = transition.current;
    if (!next || !controls.current) return;

    const alpha = 1 - Math.exp(-8 * delta);
    camera.position.lerp(next.position, alpha);
    controls.current.target.lerp(next.target, alpha);
    controls.current.update();

    if (camera.position.distanceTo(next.position) < 0.01 && controls.current.target.distanceTo(next.target) < 0.01) {
      camera.position.copy(next.position);
      controls.current.target.copy(next.target);
      controls.current.update();
      transition.current = null;
    }
  });

  const displaySpots = selected ? [selected, ...spots.filter((spot) => spot.id !== selected.id)] : spots;
  return <><color attach="background" args={["#0a0808"]}/><Stars radius={70} depth={30} count={900} factor={1.5}/><ambientLight intensity={0.55}/><directionalLight position={[4,3,5]} intensity={2.4}/><group ref={globe}><mesh onClick={(event)=>selectPoint(event.point)} onDoubleClick={(event)=>selectPoint(event.point)}><sphereGeometry args={[RADIUS,96,72]}/>{texture ? <meshBasicMaterial map={texture}/> : <meshStandardMaterial color="#b4472b" roughness={0.9}/>}</mesh>{displaySpots.map((spot) => <ArtworkMarker key={spot.id} spot={spot}/>)}</group><OrbitControls ref={controls} enablePan={false} enableRotate={interactive} enableZoom={interactive} minDistance={MIN_DISTANCE} maxDistance={MAX_DISTANCE} enableDamping dampingFactor={0.08} onStart={()=>{isInteracting.current=true;cancelTransition()}} onEnd={()=>{isInteracting.current=false}}/></>;
}

export default function MarsCanvas({ selected, spots, onSelect, controlRef, className, interactive=true, focusOnSelection=true }: { selected: Spot | null; spots: Spot[]; onSelect: (lat:number,lon:number)=>void; controlRef?: MutableRefObject<MarsControls | null>; className?: string; interactive?: boolean; focusOnSelection?: boolean }) {
  return <div className={`mars-canvas ${className ?? ""}`}><Canvas camera={{position:INITIAL_POSITION.toArray(),fov:35}} dpr={[1,1.5]} gl={{antialias:true}}><Scene selected={selected} spots={spots} onSelect={onSelect} controlRef={controlRef} interactive={interactive} focusOnSelection={focusOnSelection}/></Canvas></div>;
}
