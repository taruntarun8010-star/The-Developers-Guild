import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, OrbitControls } from '@react-three/drei';
import { useTheme } from './ThemeContext';

function GuildOrb() {
  const meshRef = useRef();
  const { isDarkMode } = useTheme();
  const orbColor = isDarkMode ? '#60a5fa' : '#4f46e5';
  const ringColor = isDarkMode ? '#a78bfa' : '#6366f1';
  const ringEmissive = isDarkMode ? '#7c3aed' : '#7c3aed';
  const orbScale = isDarkMode ? 2.15 : 1.8;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x = clock.getElapsedTime() * 0.15;
    meshRef.current.rotation.y = clock.getElapsedTime() * 0.25;
  });

  return (
    <Float speed={2.2} rotationIntensity={0.7} floatIntensity={1.25}>
      <mesh ref={meshRef} scale={orbScale} position={[1.25, 0, 0]}>
        <sphereGeometry args={[1, 80, 80]} />
        <MeshDistortMaterial
          color={orbColor}
          emissive={isDarkMode ? '#1d4ed8' : '#1e40af'}
          emissiveIntensity={isDarkMode ? 0.22 : 0.16}
          distort={isDarkMode ? 0.34 : 0.28}
          speed={1.8}
          roughness={isDarkMode ? 0.16 : 0.24}
          metalness={isDarkMode ? 0.78 : 0.62}
          transparent
          opacity={isDarkMode ? 0.96 : 0.9}
          wireframe={false}
        />
      </mesh>

      {!isDarkMode && (
        <mesh scale={2.05} position={[1.25, 0, 0]}>
          <sphereGeometry args={[1, 48, 48]} />
          <meshBasicMaterial color="#93c5fd" transparent opacity={0.12} />
        </mesh>
      )}

      {/* Ring */}
      <mesh rotation={[Math.PI / 2.5, 0, 0]} scale={[3.05, 3.05, 0.15]} position={[1.25, 0, 0]}>
        <torusGeometry args={[1, 0.06, 16, 80]} />
        <meshStandardMaterial
          color={ringColor}
          emissive={ringEmissive}
          emissiveIntensity={isDarkMode ? 0.35 : 0.22}
          metalness={0.8}
          roughness={isDarkMode ? 0.16 : 0.28}
          transparent
          opacity={isDarkMode ? 0.92 : 0.75}
        />
      </mesh>
    </Float>
  );
}

const Hero3D = () => {
  const { isDarkMode } = useTheme();

  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0, 7], fov: 40 }}>
      <ambientLight intensity={isDarkMode ? 0.5 : 0.88} />
      <hemisphereLight
        skyColor={isDarkMode ? '#1e3a8a' : '#dbeafe'}
        groundColor={isDarkMode ? '#111827' : '#f8fafc'}
        intensity={isDarkMode ? 0.35 : 0.8}
      />
      <directionalLight position={[9, 10, 6]} intensity={isDarkMode ? 1.15 : 1.2} color={isDarkMode ? '#bfdbfe' : '#ffffff'} />
      <pointLight position={[-8, -6, -4]} color={isDarkMode ? '#8b5cf6' : '#7c3aed'} intensity={isDarkMode ? 1.35 : 0.78} />
      <pointLight position={[6, 4, 2]} color={isDarkMode ? '#3b82f6' : '#2563eb'} intensity={isDarkMode ? 1 : 0.9} />
      <GuildOrb />
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={1} />
    </Canvas>
  );
};

export default Hero3D;
