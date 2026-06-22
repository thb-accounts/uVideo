import fs from 'node:fs'

export async function cleanupMulterTempFile(file, context = 'upload') {
  if (!file?.path) {
    console.info(`[${context}] multer used memory storage; no temporary upload file to delete.`)
    return
  }

  const tempPath = file.path
  await fs.promises.unlink(tempPath)
    .then(() => {
      console.info(`[${context}] deleted temporary upload file: ${tempPath}`)
    })
    .catch((error) => {
      console.warn(`[${context}] failed to delete temporary upload file: ${tempPath}`, error)
      return fs.promises.unlink(tempPath).catch(() => {})
    })
}
