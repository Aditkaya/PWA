import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { buildShip } from './shipModel'
import type { ShipContainer, ShipLayout } from './shipModel'

type View = 'perspective' | 'side' | 'top'
type Props = { layout: ShipLayout; containers: ShipContainer[]; shipName: string; onSelect: (container: ShipContainer) => void }

export default function Ship3D({ layout, containers, shipName, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const viewControl = useRef<(view: View) => void>(() => {})
  const slotControl = useRef<(show: boolean) => void>(() => {})
  const animationControl = useRef<(play: boolean) => void>(() => {})
  const [error, setError] = useState('')
  const [picked, setPicked] = useState<ShipContainer | null>(null)
  const [view, setView] = useState<View>('perspective')
  const [showSlots, setShowSlots] = useState(false)
  const [motionAllowed, setMotionAllowed] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [animated, setAnimated] = useState(motionAllowed)
  const preferences = useRef({ showSlots, animate: animated && motionAllowed })
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => setMotionAllowed(!media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  useEffect(() => {
    preferences.current = { showSlots, animate: animated && motionAllowed }
    slotControl.current(showSlots)
    animationControl.current(animated && motionAllowed)
  }, [showSlots, animated, motionAllowed])

  useEffect(() => {
    const element = host.current
    if (!element) return
    setError(''); setPicked(null); setView('perspective')
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' }) }
    catch {
      setError('Perangkat ini tidak dapat membuka WebGL 3D. Gunakan tampilan Kapal 2D atau Penampang.')
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    const canvas = renderer.domElement
    canvas.setAttribute('aria-label', 'Kapal kontainer 3D. Geser untuk memutar, cubit untuk memperbesar. Ketuk kontainer untuk melihat posisinya.')
    element.appendChild(canvas)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xa9bfca)
    const camera = new THREE.PerspectiveCamera(39, 1, .1, 2000)
    const controls = new OrbitControls(camera, canvas)
    controls.enableDamping = false
    controls.maxPolarAngle = Math.PI * .49
    controls.minPolarAngle = .015
    controls.zoomSpeed = .7
    controls.panSpeed = .7
    const model = buildShip(layout, containers, shipName)
    scene.add(model.ship)
    model.slots.visible = false
    // Hidden planning guides must not make an empty ship tiny in the viewport.
    model.ship.remove(model.slots)
    const bounds = new THREE.Box3().setFromObject(model.ship)
    const center = bounds.getCenter(new THREE.Vector3())
    const extent = Math.max(...bounds.getSize(new THREE.Vector3()).toArray())
    model.ship.add(model.slots)
    model.slots.visible = preferences.current.showSlots
    camera.far = extent * 40
    scene.fog = new THREE.Fog(0xa9bfca, extent * 3, extent * 12)
    controls.minDistance = Math.max(4, extent * .18)
    controls.maxDistance = extent * 6
    controls.target.copy(center)
    scene.add(new THREE.HemisphereLight(0xe0efff, 0x435d69, 2.1))
    const sun = new THREE.DirectionalLight(0xffedd1, 3.2)
    sun.position.set(extent * .5, extent * .9, -extent * .6)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    Object.assign(sun.shadow.camera, { left: -extent * .8, right: extent * .8, top: extent * .8, bottom: -extent * .8, near: 1, far: extent * 4 })
    sun.shadow.bias = -.00015; sun.shadow.normalBias = .04
    scene.add(sun)
    const rim = new THREE.DirectionalLight(0xc7e8ff, 1.15)
    rim.position.set(-extent, extent * .3, extent * .4); scene.add(rim)

    // Procedural sky reflections keep steel and water readable without external image downloads.
    const skyCanvas = document.createElement('canvas')
    skyCanvas.width = 512; skyCanvas.height = 256
    const sky = skyCanvas.getContext('2d')!
    const gradient = sky.createLinearGradient(0, 0, 0, 256)
    gradient.addColorStop(0, '#91b2c7'); gradient.addColorStop(.42, '#e2e8e6')
    gradient.addColorStop(.52, '#9db6bf'); gradient.addColorStop(1, '#183c4b')
    sky.fillStyle = gradient; sky.fillRect(0, 0, 512, 256)
    const glow = sky.createRadialGradient(150, 70, 1, 150, 70, 65)
    glow.addColorStop(0, '#fff5dd88'); glow.addColorStop(1, '#fff5dd00')
    sky.fillStyle = glow; sky.fillRect(0, 0, 512, 256)
    const skyTexture = new THREE.CanvasTexture(skyCanvas)
    skyTexture.colorSpace = THREE.SRGBColorSpace
    skyTexture.mapping = THREE.EquirectangularReflectionMapping
    const pmrem = new THREE.PMREMGenerator(renderer)
    const environment = pmrem.fromEquirectangular(skyTexture)
    scene.environment = environment.texture
    pmrem.dispose(); skyTexture.dispose()

    const time = { value: 0 }
    const waterMaterial = new THREE.MeshPhysicalMaterial({ color: 0x174e62, metalness: .18, roughness: .43, clearcoat: .25, clearcoatRoughness: .4 })
    waterMaterial.onBeforeCompile = shader => {
      shader.uniforms.uSeaTime = time
      shader.vertexShader = 'uniform float uSeaTime;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `
        #include <beginnormal_vertex>
        float dx = .036 * cos(position.x * .45 + position.z * .22 + uSeaTime * .65)
          + .018 * cos(position.x * .9 - position.z * .52 - uSeaTime * .8);
        float dz = .0176 * cos(position.x * .45 + position.z * .22 + uSeaTime * .65)
          - .0104 * cos(position.x * .9 - position.z * .52 - uSeaTime * .8);
        objectNormal = normalize(vec3(-dx, 1., -dz));
      `).replace('#include <begin_vertex>', `
        #include <begin_vertex>
        transformed.y += .08 * sin(position.x * .45 + position.z * .22 + uSeaTime * .65)
          + .02 * sin(position.x * .9 - position.z * .52 - uSeaTime * .8);
      `)
    }
    const waterGeometry = new THREE.PlaneGeometry(extent * 12, extent * 12, 192, 192)
    waterGeometry.rotateX(-Math.PI / 2)
    const water = new THREE.Mesh(waterGeometry, waterMaterial)
    water.position.y = -2.05; water.receiveShadow = true; scene.add(water)
    const directions: Record<View, THREE.Vector3> = {
      perspective: new THREE.Vector3(1.6, 1.05, -.8).normalize(),
      side: new THREE.Vector3(1, .25, -.04).normalize(),
      top: new THREE.Vector3(.001, 1, -.001).normalize(),
    }
    let available = true, visible = true, playing = preferences.current.animate, frame = 0, lastFrame = 0
    const started = performance.now()
    function draw() { if (available && element!.clientWidth && !document.hidden) renderer.render(scene, camera) }
    function animate(now: number) {
      frame = 0
      if (!available || !visible || !playing || document.hidden) return
      if (now - lastFrame >= 1000 / 30) { time.value = (now - started) / 1000; draw(); lastFrame = now }
      frame = requestAnimationFrame(animate)
    }
    function schedule() {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      if (available && visible && playing && !document.hidden) frame = requestAnimationFrame(animate)
      else draw()
    }
    function fit(mode: View) {
      const direction = directions[mode]
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize()
      const up = new THREE.Vector3().crossVectors(direction, right).normalize()
      const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      let distance = 0
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const offset = new THREE.Vector3(x, y, z).sub(center)
        const depth = offset.dot(direction)
        distance = Math.max(distance, Math.abs(offset.dot(right)) / (tangent * camera.aspect) + depth, Math.abs(offset.dot(up)) / tangent + depth)
      }
      camera.position.copy(center).addScaledVector(direction, distance * 1.08)
      controls.target.copy(center); controls.update(); draw()
    }
    let currentView: View = 'perspective', firstSize = true, interacted = false
    viewControl.current = mode => { currentView = mode; interacted = false; fit(mode) }
    slotControl.current = show => { model.slots.visible = show; draw() }
    animationControl.current = play => { playing = play; schedule() }
    const onStart = () => { interacted = true }
    controls.addEventListener('start', onStart)
    controls.addEventListener('change', draw)
    const observer = new ResizeObserver(() => {
      if (!element.clientWidth || !element.clientHeight) return
      camera.aspect = element.clientWidth / element.clientHeight
      camera.updateProjectionMatrix(); renderer.setSize(element.clientWidth, element.clientHeight)
      if (firstSize || !interacted) { firstSize = false; fit(currentView) } else draw()
    })
    observer.observe(element)
    const intersection = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; schedule() })
    intersection.observe(element)
    document.addEventListener('visibilitychange', schedule)
    const pointers = new Set<number>()
    let startX = 0, startY = 0, moved = false
    function down(event: PointerEvent) {
      pointers.add(event.pointerId)
      if (pointers.size === 1) { startX = event.clientX; startY = event.clientY; moved = false } else moved = true
    }
    function move(event: PointerEvent) { if (Math.hypot(event.clientX - startX, event.clientY - startY) > 6) moved = true }
    function up(event: PointerEvent) {
      pointers.delete(event.pointerId)
      if (moved || pointers.size || event.type === 'pointercancel' || !available) return
      const rect = canvas.getBoundingClientRect()
      const ray = new THREE.Raycaster()
      ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera)
      const hit = ray.intersectObjects(model.pickable, false)[0]
      setPicked(hit && hit.instanceId !== undefined ? hit.object.userData.containers[hit.instanceId] as ShipContainer : null)
    }
    function contextLost(event: Event) {
      event.preventDefault(); available = false; if (frame) cancelAnimationFrame(frame)
      setError('Tampilan 3D terhenti. Gunakan view 2D, atau buka kembali view 3D.')
    }
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up)
    canvas.addEventListener('webglcontextlost', contextLost)
    schedule()
    return () => {
      available = false; if (frame) cancelAnimationFrame(frame)
      observer.disconnect(); intersection.disconnect(); document.removeEventListener('visibilitychange', schedule)
      controls.removeEventListener('change', draw); controls.removeEventListener('start', onStart); controls.dispose()
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('webglcontextlost', contextLost)
      const geometries = new Set<THREE.BufferGeometry>(model.unusedResources)
      const materials = new Set<THREE.Material>()
      const textures = new Set<THREE.Texture>(model.textures)
      scene.traverse(object => {
        const mesh = object as THREE.Mesh
        if (mesh.geometry) geometries.add(mesh.geometry)
        if (mesh instanceof THREE.InstancedMesh) mesh.dispose()
        if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(mat => materials.add(mat))
      })
      materials.forEach(mat => {
        Object.values(mat).forEach(value => { if (value instanceof THREE.Texture) textures.add(value) })
        mat.dispose()
      })
      geometries.forEach(geometry => geometry.dispose()); textures.forEach(texture => texture.dispose())
      environment.dispose(); sun.shadow.dispose(); renderer.dispose(); canvas.remove()
      viewControl.current = () => {}; slotControl.current = () => {}; animationControl.current = () => {}
    }
  }, [layout, containers, shipName])

  return <div className="sp-three">
    <p>Geser untuk memutar, cubit untuk zoom. Ketuk kontainer untuk melihat detail.</p>
    <div className="sp-three-stage" ref={host} />
    {error && <p role="alert" className="sp-error">{error}</p>}
    <div className="sp-three-controls" aria-label="Pengaturan tampilan kapal 3D">
      <div className="sp-three-views">{([['perspective', 'Perspektif'], ['side', 'Samping'], ['top', 'Atas']] as const).map(([value, label]) =>
        <button key={value} type="button" aria-pressed={view === value} onClick={() => { setView(value); viewControl.current(value) }}>{label}</button>)}</div>
      <div className="sp-three-options"><button type="button" aria-pressed={showSlots} onClick={() => setShowSlots(value => !value)}>Slot kosong</button><button type="button" disabled={!motionAllowed} aria-pressed={animated && motionAllowed} onClick={() => setAnimated(value => !value)}>Animasi air</button></div>
    </div>
    <p className="sp-three-caption">Haluan di ujung runcing, anjungan di buritan. Model mengikuti susunan bay, row, dan tier; bentuknya bukan ukuran teknis kapal.</p>
    {picked && <div className="sp-current"><div><strong>{picked.nomor_kontainer || `Manifest ${picked.id}`}</strong><p>{picked.size_kontainer} ft · Bay {picked.bay} / Row {picked.row} / Tier {picked.tier}</p></div><button type="button" onClick={() => onSelect(picked)}>Ubah posisi</button></div>}
  </div>
}
