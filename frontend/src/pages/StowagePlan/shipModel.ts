import * as THREE from 'three'

export type ShipContainer = { id: number; nomor_kontainer: string | null; size_kontainer: string | null; plan_id: number | null; bay: string | null; row: string | null; tier: string | null }
export type ShipLayout = { bays: string[]; rows: string[]; tiers: string[]; disabled_slots: string[] }

function paintTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256; canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#e2e2e2'; ctx.fillRect(0, 0, 256, 128)
  for (let x = 0; x < 256; x += 16) {
    const shade = ctx.createLinearGradient(x, 0, x + 16, 0)
    shade.addColorStop(0, '#a4a4a4'); shade.addColorStop(.2, '#eeeeee')
    shade.addColorStop(.65, '#eeeeee'); shade.addColorStop(1, '#a4a4a4')
    ctx.fillStyle = shade; ctx.fillRect(x, 4, 16, 120)
  }
  ctx.fillStyle = '#898989'; ctx.fillRect(0, 0, 256, 4); ctx.fillRect(0, 124, 256, 4)
  const texture = new THREE.CanvasTexture(canvas)
  return texture
}

export function buildShip(layout: ShipLayout, containers: ShipContainer[], shipName: string) {
  const ship = new THREE.Group()
  const slots = new THREE.Group()
  ship.add(slots)
  const bays = [...layout.bays].sort((a, b) => +a - +b)
  const tiers = [...layout.tiers].sort((a, b) => +a - +b)
  const rows = [...layout.rows].sort((a, b) => {
    const ea = +a % 2 === 0, eb = +b % 2 === 0
    return ea !== eb ? ea ? -1 : 1 : ea ? +b - +a : +a - +b
  })
  const width = rows.length * 1.1 + 2.1
  const length = bays.length * 2.8
  const half = length / 2
  // z runs from the pointed bow (-z) to the transom and accommodation (+z).
  const stations = [
    [-half - 6.8, .015, .65], [-half - 5.5, .35, .45], [-half - 3.5, .75, .2],
    [-half - 1.1, .98, 0], [-half + .5, 1, 0], [half - .5, 1, 0],
    [half + 2.8, .96, .04], [half + 4.7, .79, .08],
  ]
  const material = (color: number, metalness = .12, roughness = .58) => new THREE.MeshStandardMaterial({ color, metalness, roughness })
  const navy = material(0x243b4a, .48, .42)
  const red = material(0x983d32, .22, .68)
  const deckPaint = material(0x747b70, .25, .75)
  const steel = material(0xa7b0ad, .55, .4)
  const ivory = material(0xe6e6d7, .14, .55)
  const dark = material(0x22333c, .35, .4)
  const glass = material(0x214a5b, .65, .2)
  const safety = material(0xdb7731, .15, .6)
  const unitBox = new THREE.BoxGeometry(1, 1, 1)
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10)
  function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) {
    const mesh = new THREE.Mesh(unitBox, mat)
    mesh.scale.set(w, h, d); mesh.position.set(x, y, z)
    mesh.castShadow = true; mesh.receiveShadow = true
    ship.add(mesh)
    return mesh
  }
  function pole(radius: number, height: number, mat: THREE.Material, x: number, y: number, z: number) {
    const mesh = new THREE.Mesh(cylinder, mat)
    mesh.scale.set(radius, height, radius); mesh.position.set(x, y, z)
    mesh.castShadow = true; ship.add(mesh)
    return mesh
  }
  function hullBand(profile: number[][], mat: THREE.Material) {
    const vertices: number[] = [], indices: number[] = []
    stations.forEach(([z, beam, sheer]) => profile.forEach(([x, y]) => vertices.push(x * width / 2 * beam, y + sheer, z)))
    const ring = profile.length
    for (let s = 0; s < stations.length - 1; s++) for (let p = 0; p < ring; p++) {
      const a = s * ring + p, b = s * ring + (p + 1) % ring
      indices.push(a, b + ring, b, a, a + ring, b + ring)
    }
    // Close bow and stern, including the below-water hull.
    for (let p = 1; p < ring - 1; p++) {
      indices.push(0, p, p + 1)
      const end = (stations.length - 1) * ring
      indices.push(end, end + p + 1, end + p)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setIndex(indices); geometry.computeVertexNormals()
    const mesh = new THREE.Mesh(geometry, mat)
    mesh.castShadow = true; mesh.receiveShadow = true
    ship.add(mesh)
  }
  hullBand([[-1, .12], [1, .12], [.94, -1.2], [-.94, -1.2]], navy)
  hullBand([[-.94, -1.2], [.94, -1.2], [.78, -2.35], [.4, -2.8], [-.4, -2.8], [-.78, -2.35]], red)
  hullBand([[-1.006, .13], [1.006, .13], [1.003, .02], [-1.003, .02]], steel)
  // A matching deck follows the flare and raised forecastle rather than a rectangular slab.
  const deckPositions: number[] = [], deckIndices: number[] = []
  stations.forEach(([z, beam, sheer]) => {
    deckPositions.push(-width / 2 * beam, .15 + sheer, z, width / 2 * beam, .15 + sheer, z)
  })
  for (let i = 0; i < stations.length - 1; i++) {
    const a = i * 2
    deckIndices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
  }
  const deckGeometry = new THREE.BufferGeometry()
  deckGeometry.setAttribute('position', new THREE.Float32BufferAttribute(deckPositions, 3))
  deckGeometry.setIndex(deckIndices); deckGeometry.computeVertexNormals()
  const deck = new THREE.Mesh(deckGeometry, deckPaint)
  deck.receiveShadow = true; ship.add(deck)
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), red)
  bulb.scale.set(width * .12, .48, 1.45); bulb.position.set(0, -1.95, -half - 5.6); ship.add(bulb)

  // Hatch covers remain visible on an empty voyage; unplaced manifests are not fabricated cargo.
  const hatch = material(0x596765, .3, .73)
  bays.forEach((_, index) => {
    const z = (index - (bays.length - 1) / 2) * 2.8
    box(rows.length * 1.1 + .22, .16, 2.65, hatch, 0, .24, z)
    for (const side of [-1, 1]) box(.06, .035, 2.5, steel, side * (rows.length * 1.1 / 2 + .02), .34, z)
  })

  // Deck safety railings: thin tubes and one instanced batch of stanchions.
  const railPositions: THREE.Vector3[] = []
  for (const side of [-1, 1]) {
    const path = stations.map(([z, beam, sheer]) => new THREE.Vector3(side * width / 2 * beam * .97, .74 + sheer, z))
    for (const height of [0, -.25]) {
      const curve = new THREE.CatmullRomCurve3(path.map(point => point.clone().add(new THREE.Vector3(0, height, 0))))
      ship.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 56, .018, 5, false), ivory))
    }
    for (let s = 0; s < stations.length - 1; s++) {
      const [z, beam, sheer] = stations[s], [nextZ, nextBeam, nextSheer] = stations[s + 1]
      const count = Math.max(1, Math.ceil((nextZ - z) / 1.3))
      for (let i = 0; i < count; i++) {
        const t = i / count
        railPositions.push(new THREE.Vector3(side * width / 2 * THREE.MathUtils.lerp(beam, nextBeam, t) * .97,
          .44 + THREE.MathUtils.lerp(sheer, nextSheer, t), THREE.MathUtils.lerp(z, nextZ, t)))
      }
    }
  }
  const stanchions = new THREE.InstancedMesh(new THREE.CylinderGeometry(.018, .018, .58, 5), ivory, railPositions.length)
  railPositions.forEach((position, i) => stanchions.setMatrixAt(i, new THREE.Matrix4().makeTranslation(position.x, position.y, position.z)))
  ship.add(stanchions)

  // A stepped accommodation block, glazed wheelhouse and bridge wings.
  const stern = half + 2.6
  const bridgeHeight = Math.max(3.7, tiers.length * 1.4 + .65)
  box(width * .72, bridgeHeight - .9, 2.7, ivory, 0, (bridgeHeight - .9) / 2 + .22, stern)
  box(width * .87, .18, 3.0, ivory, 0, bridgeHeight - .65, stern - .08)
  box(width * .68, 1.0, 2.25, ivory, 0, bridgeHeight - .05, stern - .28)
  box(width * .72, .14, 2.5, ivory, 0, bridgeHeight + .52, stern - .28)
  box(width * .64, .45, .035, glass, 0, bridgeHeight + .07, stern - 1.42)
  for (const side of [-1, 1]) {
    box(.035, .45, 1.95, glass, side * width * .344, bridgeHeight + .07, stern - .32)
    for (let z = -.9; z <= .9; z += .45) box(.05, .48, .035, ivory, side * width * .35, bridgeHeight + .07, stern + z - .28)
    // Lifeboats and their davits sit outside the accommodation footprint.
    const boat = new THREE.Mesh(new THREE.CapsuleGeometry(.2, .85, 4, 8), safety)
    boat.rotation.x = Math.PI / 2; boat.position.set(side * width * .42, 1.45, stern)
    boat.castShadow = true; ship.add(boat)
    box(.1, 1.1, .08, steel, side * width * .43, .85, stern + .5)
  }
  for (let x = -width * .28; x <= width * .3; x += .4) box(.045, .5, .05, ivory, x, bridgeHeight + .07, stern - 1.45)
  for (let floor = 1; floor < bridgeHeight - 1.3; floor += .85) {
    for (const side of [-1, 1]) for (let z = -.75; z <= .8; z += .7) box(.035, .28, .38, glass, side * width * .365, floor, stern + z)
    box(width * .73, .035, 2.72, steel, 0, floor + .32, stern)
  }
  const funnel = material(0xc6a65c, .26, .56)
  box(.66, 1.45, .75, funnel, width * .18, bridgeHeight + 1.05, stern + .6)
  box(.72, .3, .8, dark, width * .18, bridgeHeight + 1.75, stern + .6)
  pole(.09, .5, dark, width * .18 - .15, bridgeHeight + 2, stern + .6)
  pole(.09, .5, dark, width * .18 + .15, bridgeHeight + 2, stern + .6)
  pole(.035, 2.05, ivory, 0, bridgeHeight + 1.5, stern - .65)
  box(1.5, .045, .06, ivory, 0, bridgeHeight + 2.2, stern - .65)
  box(.7, .08, .18, dark, 0, bridgeHeight + 2.58, stern - .65)
  for (const side of [-1, 1]) {
    const navigation = new THREE.MeshBasicMaterial({ color: side < 0 ? 0xe35a4f : 0x5cb788 })
    box(.12, .12, .16, navigation, side * width * .43, bridgeHeight - .5, stern - 1.3)
  }
  // Forecastle winch, bollards, anchor pockets and mast.
  const fore = -half - 3.4
  box(width * .35, .32, .9, navy, 0, .52, fore)
  for (const side of [-1, 1]) {
    const drum = pole(.23, .5, dark, side * .5, .8, fore)
    drum.rotation.z = Math.PI / 2
    pole(.085, .32, dark, side * width * .28, .65, fore + .6)
    pole(.085, .32, dark, side * width * .28, .65, fore + 1)
    const anchor = box(.035, .2, .35, dark, side * width * .4, -.15, fore - .25)
    anchor.rotation.y = side * .4
  }
  pole(.03, 1.5, ivory, 0, 1.2, fore - 1)

  if (shipName) {
    const canvas = document.createElement('canvas')
    canvas.width = 1024; canvas.height = 128
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#e8e9dc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = '600 64px Arial'; ctx.fillText(shipName.toUpperCase(), 512, 64, 980)
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace
    const nameMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide })
    for (const side of [-1, 1]) {
      const label = new THREE.Mesh(new THREE.PlaneGeometry(4.1, .5), nameMaterial)
      label.rotation.y = side * Math.PI / 2
      label.position.set(side * (width / 2 - .01), -.4, -half + 2.3)
      ship.add(label)
    }
  }

  const occupied = new Map<string, ShipContainer>(), tails = new Set<string>()
  for (const container of containers) {
    if (!container.plan_id || !container.bay || !container.row || !container.tier) continue
    occupied.set(container.bay + container.row + container.tier, container)
    const b = bays.indexOf(container.bay)
    if (String(container.size_kontainer).includes('40') && b >= 0 && bays[b + 1]) tails.add(bays[b + 1] + container.row + container.tier)
  }
  const box20 = new THREE.BoxGeometry(.97, 1.2, 2.55), box40 = new THREE.BoxGeometry(.97, 1.2, 5.35)
  const edge20 = new THREE.EdgesGeometry(box20), edge40 = new THREE.EdgesGeometry(box40)
  const cargo: { container: ShipContainer; position: THREE.Vector3; forty: boolean }[] = []
  const emptyEdges: number[] = [], inactiveEdges: number[] = [], cargoEdges: number[] = []
  const disabled = new Set(layout.disabled_slots)
  function appendEdges(target: number[], geometry: THREE.BufferGeometry, position: THREE.Vector3) {
    const attribute = geometry.getAttribute('position')
    for (let i = 0; i < attribute.count; i++) target.push(attribute.getX(i) + position.x, attribute.getY(i) + position.y, attribute.getZ(i) + position.z)
  }
  bays.forEach((bay, b) => rows.forEach((row, r) => tiers.forEach((tier, t) => {
    const slot = bay + row + tier, container = occupied.get(slot)
    const position = new THREE.Vector3((r - (rows.length - 1) / 2) * 1.1, .96 + t * 1.4, (b - (bays.length - 1) / 2) * 2.8)
    if (container) {
      const forty = String(container.size_kontainer).includes('40')
      if (forty) position.z += 1.4
      cargo.push({ container, position, forty }); appendEdges(cargoEdges, forty ? edge40 : edge20, position)
    } else if (!tails.has(slot)) appendEdges(disabled.has(slot) ? inactiveEdges : emptyEdges, edge20, position)
  })))
  const corrugation = paintTexture()
  const pickable: THREE.InstancedMesh[] = []
  for (const forty of [false, true]) {
    const items = cargo.filter(item => item.forty === forty)
    if (!items.length) continue
    const paint = new THREE.MeshStandardMaterial({ color: 0xffffff, map: corrugation, bumpMap: corrugation, bumpScale: .035, metalness: .25, roughness: .62 })
    const mesh = new THREE.InstancedMesh(forty ? box40 : box20, paint, items.length)
    items.forEach((item, index) => {
      mesh.setMatrixAt(index, new THREE.Matrix4().makeTranslation(item.position.x, item.position.y, item.position.z))
      mesh.setColorAt(index, new THREE.Color(forty ? 0x3975ac : 0xd9783e).multiplyScalar(.9 + (item.container.id % 7) * .025))
    })
    mesh.userData.containers = items.map(item => item.container)
    mesh.castShadow = true; mesh.receiveShadow = true
    ship.add(mesh); pickable.push(mesh)
  }
  if (cargo.length) {
    const locks = new THREE.InstancedMesh(new THREE.BoxGeometry(.025, .88, .035), steel, cargo.length * 2)
    cargo.forEach((item, index) => [-1, 1].forEach((side, s) => locks.setMatrixAt(index * 2 + s,
      new THREE.Matrix4().makeTranslation(item.position.x + side * .23, item.position.y, item.position.z - (item.forty ? 2.675 : 1.275) - .018))))
    ship.add(locks)
  }
  function lines(points: number[], color: number, opacity: number, group: THREE.Group) {
    if (!points.length) return
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    group.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false })))
  }
  lines(cargoEdges, 0x253440, .34, ship)
  lines(emptyEdges, 0xc0d1d5, .19, slots)
  lines(inactiveEdges, 0x6d7680, .25, slots)
  // Repeated windows, deck fittings and rail posts share GPU batches on mobile.
  const detailGroups = new Map<string, THREE.Mesh[]>()
  for (const object of ship.children) {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh ||
      (object.geometry !== unitBox && object.geometry !== cylinder) || Array.isArray(object.material)) continue
    const key = object.geometry.uuid + object.material.uuid
    const group = detailGroups.get(key) || []
    group.push(object); detailGroups.set(key, group)
  }
  for (const objects of detailGroups.values()) {
    const batch = new THREE.InstancedMesh(objects[0].geometry, objects[0].material, objects.length)
    objects.forEach((object, index) => { object.updateMatrix(); batch.setMatrixAt(index, object.matrix); ship.remove(object) })
    batch.castShadow = true; batch.receiveShadow = true; ship.add(batch)
  }
  // These temporary source geometries may not be referenced by a mesh on an empty voyage.
  const unusedResources = [box20, box40, edge20, edge40]
  return { ship, slots, pickable, textures: [corrugation], unusedResources }
}
