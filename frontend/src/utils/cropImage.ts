export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })

export function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180
}

export default async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  rotation = 0
): Promise<File | null> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return null
  }

  // set canvas size to match the bounding box
  canvas.width = image.width
  canvas.height = image.height

  ctx.translate(image.width / 2, image.height / 2)
  ctx.rotate(getRadianAngle(rotation))
  ctx.translate(-image.width / 2, -image.height / 2)

  ctx.drawImage(image, 0, 0)

  const croppedCanvas = document.createElement('canvas')
  const croppedCtx = croppedCanvas.getContext('2d')

  if (!croppedCtx) {
    return null
  }

  // Compress: Set maximum size for profile picture (e.g., 512px)
  const TARGET_SIZE = 512
  const finalSize = Math.min(pixelCrop.width, TARGET_SIZE)

  // Set the size of the cropped canvas
  croppedCanvas.width = finalSize
  croppedCanvas.height = finalSize

  // Draw the cropped image onto the new canvas and scale it down
  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    finalSize,
    finalSize
  )

  return new Promise((resolve, reject) => {
    croppedCanvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas is empty'))
        return
      }
      const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg' })
      resolve(file)
    }, 'image/jpeg', 0.8) // Compress quality to 80%
  })
}
