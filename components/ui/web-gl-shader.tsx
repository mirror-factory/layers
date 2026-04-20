"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

type ShaderState = "idle" | "recording" | "summarizing" | "done"

interface WebGLShaderProps {
  /** 0-1: real-time audio energy from mic RMS. Drives wave amplitude + line split. */
  audioLevel?: number
  /** Controls the animation phase */
  state?: ShaderState
  /** Additional CSS classes */
  className?: string
}

export function WebGLShader({
  audioLevel = 0,
  state = "idle",
  className = "",
}: WebGLShaderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const refs = useRef<{
    scene: THREE.Scene | null
    camera: THREE.OrthographicCamera | null
    renderer: THREE.WebGLRenderer | null
    mesh: THREE.Mesh | null
    uniforms: {
      resolution: { value: number[] }
      time: { value: number }
      xScale: { value: number }
      yScale: { value: number }
      distortion: { value: number }
      opacity: { value: number }
    } | null
    animationId: number | null
  }>({
    scene: null,
    camera: null,
    renderer: null,
    mesh: null,
    uniforms: null,
    animationId: null,
  })

  const audioRef = useRef(0)
  const stateRef = useRef<ShaderState>("idle")

  useEffect(() => { audioRef.current = audioLevel }, [audioLevel])
  useEffect(() => { stateRef.current = state }, [state])

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return

    const canvas = canvasRef.current
    const container = containerRef.current
    const r = refs.current

    const vertexShader = `
      attribute vec3 position;
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `

    // Enhanced shader: adds opacity uniform for fade-out transitions
    const fragmentShader = `
      precision highp float;
      uniform vec2 resolution;
      uniform float time;
      uniform float xScale;
      uniform float yScale;
      uniform float distortion;
      uniform float opacity;

      void main() {
        vec2 p = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);

        float d = length(p) * distortion;

        float rx = p.x * (1.0 + d);
        float gx = p.x;
        float bx = p.x * (1.0 - d);

        float r = 0.05 / abs(p.y + sin((rx + time) * xScale) * yScale);
        float g = 0.05 / abs(p.y + sin((gx + time) * xScale) * yScale);
        float b = 0.05 / abs(p.y + sin((bx + time) * xScale) * yScale);

        gl_FragColor = vec4(r * opacity, g * opacity, b * opacity, 1.0);
      }
    `

    const initScene = () => {
      r.scene = new THREE.Scene()
      r.renderer = new THREE.WebGLRenderer({ canvas, alpha: true })
      r.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      r.renderer.setClearColor(new THREE.Color(0x000000), 0)

      r.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, -1)

      const rect = container.getBoundingClientRect()
      r.uniforms = {
        resolution: { value: [rect.width, rect.height] },
        time: { value: 0.0 },
        xScale: { value: 1.5 },
        yScale: { value: 0.15 },
        distortion: { value: 0.02 },
        opacity: { value: 1.0 },
      }

      const position = [
        -1, -1, 0, 1, -1, 0, -1, 1, 0,
        1, -1, 0, -1, 1, 0, 1, 1, 0,
      ]
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(position), 3))

      const material = new THREE.RawShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: r.uniforms,
        side: THREE.DoubleSide,
        transparent: true,
      })

      r.mesh = new THREE.Mesh(geometry, material)
      r.scene.add(r.mesh)
      handleResize()
    }

    const animate = () => {
      if (!r.uniforms) { r.animationId = requestAnimationFrame(animate); return }

      const u = r.uniforms
      const s = stateRef.current
      const audio = audioRef.current

      // Speed varies by state
      const speedMap = { idle: 0.008, recording: 0.012, summarizing: 0.025, done: 0.005 }
      u.time.value += speedMap[s]

      // Target values based on state + audio level
      let targetY: number, targetDist: number, targetOpacity: number

      if (s === "idle") {
        // Gentle white-ish line (low distortion = lines overlap)
        targetY = 0.15 + audio * 0.1
        targetDist = 0.02
        targetOpacity = 0.8
      } else if (s === "recording") {
        // Lines split with audio energy. Audio drives amplitude + chromatic split.
        targetY = 0.2 + audio * 0.6     // big amplitude on loud audio
        targetDist = 0.04 + audio * 0.15 // lines split apart with volume
        targetOpacity = 1.0
      } else if (s === "summarizing") {
        // Lines merge back toward white, high energy movement
        targetY = 0.4
        targetDist = 0.03 // converging
        targetOpacity = 1.0
        u.xScale.value += (2.5 - u.xScale.value) * 0.02 // higher frequency
      } else {
        // Done: single white line, fade out
        targetY = 0.1
        targetDist = 0.0 // fully merged = white
        targetOpacity = Math.max(0, u.opacity.value - 0.015)
      }

      // Restore xScale for non-summarizing states
      if (s !== "summarizing") {
        u.xScale.value += (1.5 - u.xScale.value) * 0.03
      }

      // Smooth interpolation (lerp)
      const lerp = s === "recording" ? 0.12 : 0.04 // faster response when recording
      u.yScale.value += (targetY - u.yScale.value) * lerp
      u.distortion.value += (targetDist - u.distortion.value) * lerp
      u.opacity.value += (targetOpacity - u.opacity.value) * 0.05

      if (r.renderer && r.scene && r.camera) {
        r.renderer.render(r.scene, r.camera)
      }
      r.animationId = requestAnimationFrame(animate)
    }

    const handleResize = () => {
      if (!r.renderer || !r.uniforms) return
      const rect = container.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      r.renderer.setSize(w, h, false)
      canvas.style.width = w + "px"
      canvas.style.height = h + "px"
      r.uniforms.resolution.value = [w, h]
    }

    initScene()
    animate()

    const ro = new ResizeObserver(handleResize)
    ro.observe(container)

    return () => {
      if (r.animationId) cancelAnimationFrame(r.animationId)
      ro.disconnect()
      if (r.mesh) {
        r.scene?.remove(r.mesh)
        r.mesh.geometry.dispose()
        if (r.mesh.material instanceof THREE.Material) r.mesh.material.dispose()
      }
      r.renderer?.dispose()
    }
  }, [])

  return (
    <div ref={containerRef} className={`relative ${className}`} style={{ pointerEvents: "none" }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  )
}
