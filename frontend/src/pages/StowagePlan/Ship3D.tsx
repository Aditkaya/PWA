import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

type Container = { id: number; nomor_kontainer: string | null; size_kontainer: string | null; plan_id: number | null; bay: string | null; row: string | null; tier: string | null }
type Layout = { bays: string[]; rows: string[]; tiers: string[]; disabled_slots: string[] }
type Props = { layout: Layout; containers: Container[]; onSelect: (container: Container) => void }

export default function Ship3D({ layout, containers, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const reset = useRef<() => void>(() => {})
  const [error, setError] = useState('')
  const [picked, setPicked] = useState<Container | null>(null)

  useEffect(() => {
    const element = host.current
    if (!element) return
    setError('')
    setPicked(null)
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    } catch {
      setError('Perangkat ini tidak dapat membuka WebGL 3D. Gunakan tampilan Kapal 2D atau Penampang.')
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setClearColor(0x0b172b)
    renderer.domElement.setAttribute('aria-label', 'Kapal 3D. Geser untuk memutar, cubit untuk memperbesar. Posisi juga tersedia pada tampilan 2D.')
    element.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, .1, 2000)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = false
    controls.maxPolarAngle = Math.PI * .49
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 2))
    const sun = new THREE.DirectionalLight(0xffffff, 3)
    sun.position.set(15, 30, -20)
    scene.add(sun)
    const ship = new THREE.Group()
    scene.add(ship)
    const bays = [...layout.bays].sort((a, b) => +a - +b)
    const tiers = [...layout.tiers].sort((a, b) => +a - +b)
    const rows = [...layout.rows].sort((a, b) => {
      const ea = +a % 2 === 0, eb = +b % 2 === 0
      return ea !== eb ? ea ? -1 : 1 : ea ? +b - +a : +a - +b
    })
    const width = rows.length * 1.1 + 1.8
    const length = bays.length * 2.8
    const half = length / 2
    const hullShape = new THREE.Shape()
    hullShape.moveTo(-width / 2, half + 4)
    hullShape.lineTo(width / 2, half + 4)
    hullShape.lineTo(width / 2, -half + .6)
    hullShape.quadraticCurveTo(width / 2, -half - 3, 0, -half - 5)
    hullShape.quadraticCurveTo(-width / 2, -half - 3, -width / 2, -half + .6)
    hullShape.closePath()
    // The same shape/orientation is used for both hull and deck.
    const hullGeometry = new THREE.ExtrudeGeometry(hullShape, { depth: 2.2, bevelEnabled: false })
    hullGeometry.rotateX(Math.PI / 2)
    const hull = new THREE.Mesh(hullGeometry, new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: .7 }))
    hull.position.y = -.25
    ship.add(hull)
    const deckGeometry = new THREE.ShapeGeometry(hullShape)
    deckGeometry.rotateX(Math.PI / 2)
    const deck = new THREE.Mesh(deckGeometry, new THREE.MeshStandardMaterial({ color: 0x475569, side: THREE.DoubleSide }))
    deck.position.y = -.23
    ship.add(deck)

    function box(w: number, h: number, d: number, color: number, x: number, y: number, z: number) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color }))
      mesh.position.set(x, y, z)
      ship.add(mesh)
      return mesh
    }
    box(width * .82, 3.6, 2.3, 0xe2e8f0, 0, 1.6, half + 2)
    box(width * .84, .65, 2.4, 0x0c4a6e, 0, 2.5, half + 2)
    box(width * .9, .2, 2.6, 0xffffff, 0, 3.5, half + 2)
    box(.8, 2, .9, 0xeab308, 0, 4.1, half + 2.3)
    box(.85, .4, .95, 0x1e293b, 0, 5.1, half + 2.3)

    const occupied = new Map<string, Container>()
    const tails = new Set<string>()
    for (const c of containers) {
      if (!c.plan_id || !c.bay || !c.row || !c.tier) continue
      occupied.set(c.bay + c.row + c.tier, c)
      const index = bays.indexOf(c.bay)
      if (String(c.size_kontainer).includes('40') && index >= 0 && bays[index + 1]) tails.add(bays[index + 1] + c.row + c.tier)
    }
    const disabled = new Set(layout.disabled_slots)
    const pickable: THREE.Mesh[] = []
    const box20 = new THREE.BoxGeometry(.94, 1.2, 2.5)
    const box40 = new THREE.BoxGeometry(.94, 1.2, 5.3)
    const orange = new THREE.MeshStandardMaterial({ color: 0xf97316 })
    const blue = new THREE.MeshStandardMaterial({ color: 0x3b82f6 })
    const edges20 = new THREE.EdgesGeometry(box20)
    const edges40 = new THREE.EdgesGeometry(box40)
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x0f172a, transparent: true, opacity: .5 })
    const emptyPositions: THREE.Vector3[] = []
    const disabledPositions: THREE.Vector3[] = []
    bays.forEach((bay, b) => rows.forEach((row, r) => tiers.forEach((tier, t) => {
      const slot = bay + row + tier
      const c = occupied.get(slot)
      const position = new THREE.Vector3((r - (rows.length - 1) / 2) * 1.1, .5 + t * 1.4, (b - (bays.length - 1) / 2) * 2.8)
      if (c) {
        const forty = String(c.size_kontainer).includes('40')
        const mesh = new THREE.Mesh(forty ? box40 : box20, forty ? blue : orange)
        mesh.position.copy(position)
        if (forty) mesh.position.z += 1.4
        mesh.userData.container = c
        mesh.add(new THREE.LineSegments(forty ? edges40 : edges20, edgeMaterial))
        ship.add(mesh)
        pickable.push(mesh)
      } else if (!tails.has(slot)) {
        (disabled.has(slot) ? disabledPositions : emptyPositions).push(position)
      }
    })))
    // Empty slots are batched into two draw calls for mobile devices.
    for (const [positions, color] of [[emptyPositions, 0x94a3b8], [disabledPositions, 0xef4444]] as const) {
      const instances = new THREE.InstancedMesh(box20, new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: .16 }), positions.length)
      positions.forEach((p, i) => instances.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)))
      instances.instanceMatrix.needsUpdate = true
      ship.add(instances)
    }
    const bounds = new THREE.Box3().setFromObject(ship)
    const center = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    const extent = Math.max(size.x, size.y, size.z)
    camera.far = Math.max(2000, extent * 20)
    controls.target.copy(center)
    controls.minDistance = Math.max(3, extent * .15)
    controls.maxDistance = extent * 5
    let available = true
    function draw() {
      if (available && element!.clientWidth > 0) renderer.render(scene, camera)
    }
    function fit() {
      const distance = extent / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / Math.min(camera.aspect, 1) * 1.2
      camera.position.copy(center).add(new THREE.Vector3(.8, .9, -1).normalize().multiplyScalar(distance))
      controls.target.copy(center)
      controls.update()
      draw()
    }
    reset.current = fit
    controls.addEventListener('change', draw)
    let firstSize = true
    const observer = new ResizeObserver(() => {
      if (!element.clientWidth || !element.clientHeight) return
      camera.aspect = element.clientWidth / element.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(element.clientWidth, element.clientHeight)
      if (firstSize) { firstSize = false; fit() } else draw()
    })
    observer.observe(element)
    const pointers = new Set<number>()
    let startX = 0, startY = 0, moved = false
    function down(event: PointerEvent) {
      pointers.add(event.pointerId)
      if (pointers.size === 1) { startX = event.clientX; startY = event.clientY; moved = false } else moved = true
    }
    function move(event: PointerEvent) {
      if (Math.hypot(event.clientX - startX, event.clientY - startY) > 6) moved = true
    }
    function up(event: PointerEvent) {
      pointers.delete(event.pointerId)
      if (moved || pointers.size || event.type === 'pointercancel') return
      const rect = renderer.domElement.getBoundingClientRect()
      const ray = new THREE.Raycaster()
      ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera)
      const hit = ray.intersectObjects(pickable, false)[0]
      setPicked(hit ? hit.object.userData.container as Container : null)
    }
    function contextLost(event: Event) {
      event.preventDefault()
      available = false
      setError('Tampilan 3D terhenti. Gunakan view 2D, atau buka kembali view 3D.')
    }
    const canvas = renderer.domElement
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    canvas.addEventListener('webglcontextlost', contextLost)
    return () => {
      observer.disconnect()
      controls.removeEventListener('change', draw)
      controls.dispose()
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('webglcontextlost', contextLost)
      const geometries = new Set<THREE.BufferGeometry>([box20, box40, edges20, edges40])
      const materials = new Set<THREE.Material>([orange, blue, edgeMaterial])
      scene.traverse(object => {
        const mesh = object as THREE.Mesh
        if (mesh.geometry) geometries.add(mesh.geometry)
        if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(m => materials.add(m))
      })
      geometries.forEach(g => g.dispose())
      materials.forEach(m => m.dispose())
      renderer.dispose()
      canvas.remove()
      reset.current = () => {}
    }
  }, [layout, containers])

  return <div className="sp-three">
    <p>Geser satu jari untuk memutar. Cubit untuk zoom; dua jari untuk menggeser. Ketuk kontainer untuk detail.</p>
    <div className="sp-three-stage" ref={host} />
    {error && <p role="alert" className="sp-error">{error}</p>}
    <button type="button" className="sp-map-button" onClick={() => reset.current()}>Reset sudut pandang</button>
    <p className="sp-three-caption">Haluan: ujung runcing · Buritan: anjungan putih. Bentuk kapal adalah skema berdasarkan layout Master Kapal.</p>
    {picked && <div className="sp-current"><div><strong>{picked.nomor_kontainer || `Manifest ${picked.id}`}</strong><p>{picked.size_kontainer} ft · Bay {picked.bay} / Row {picked.row} / Tier {picked.tier}</p></div><button type="button" onClick={() => onSelect(picked)}>Ubah posisi</button></div>}
  </div>
}
