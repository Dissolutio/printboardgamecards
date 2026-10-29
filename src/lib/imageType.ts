const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
}

export function getImageType(file: { type: string; name: string }): string | undefined {
  if (file.type && file.type.toLowerCase() !== 'application/octet-stream') {
    return file.type
  }

  const extensionStart = file.name.lastIndexOf('.')
  if (extensionStart < 0) return undefined

  return IMAGE_TYPES[file.name.slice(extensionStart + 1).toLowerCase()]
}
