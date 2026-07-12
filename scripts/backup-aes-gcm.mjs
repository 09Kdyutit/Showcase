#!/usr/bin/env node

import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const MAGIC = Buffer.from('SHOWCASE-BACKUP-V1\0', 'utf8')
const ITERATIONS = 600_000
const TAG_BYTES = 16

function usage() {
  console.error('Usage: BACKUP_PASSPHRASE=... node scripts/backup-aes-gcm.mjs <encrypt|decrypt> <input> <output>')
  process.exit(2)
}

function requiredPassphrase() {
  const value = process.env.BACKUP_PASSPHRASE
  if (!value || value.length < 32) throw new Error('BACKUP_PASSPHRASE must contain at least 32 characters')
  return value
}

function encrypt(input, output, passphrase) {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = pbkdf2Sync(passphrase, salt, ITERATIONS, 32, 'sha256')
  try {
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const ciphertext = Buffer.concat([cipher.update(input), cipher.final()])
    const authTag = cipher.getAuthTag()
    const header = Buffer.from(JSON.stringify({
      schema_version: 1,
      cipher: 'aes-256-gcm',
      kdf: 'pbkdf2-sha256',
      iterations: ITERATIONS,
      salt_base64: salt.toString('base64'),
      iv_base64: iv.toString('base64'),
      auth_tag_bytes: TAG_BYTES,
    }), 'utf8')
    const headerLength = Buffer.allocUnsafe(4)
    headerLength.writeUInt32BE(header.length)
    writeFileSync(output, Buffer.concat([MAGIC, headerLength, header, ciphertext, authTag]), {
      flag: 'wx',
      mode: 0o600,
    })
  } finally {
    key.fill(0)
  }
}

function decrypt(input, output, passphrase) {
  if (!input.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Backup header is invalid')
  const headerLength = input.readUInt32BE(MAGIC.length)
  const headerStart = MAGIC.length + 4
  const headerEnd = headerStart + headerLength
  if (headerEnd + TAG_BYTES > input.length) throw new Error('Backup archive is truncated')
  const header = JSON.parse(input.subarray(headerStart, headerEnd).toString('utf8'))
  if (
    header.schema_version !== 1
    || header.cipher !== 'aes-256-gcm'
    || header.kdf !== 'pbkdf2-sha256'
    || header.iterations !== ITERATIONS
    || header.auth_tag_bytes !== TAG_BYTES
  ) {
    throw new Error('Backup cryptographic parameters are unsupported')
  }
  const salt = Buffer.from(header.salt_base64, 'base64')
  const iv = Buffer.from(header.iv_base64, 'base64')
  if (salt.length !== 16 || iv.length !== 12) throw new Error('Backup salt or IV is invalid')
  const ciphertextEnd = input.length - TAG_BYTES
  const ciphertext = input.subarray(headerEnd, ciphertextEnd)
  const authTag = input.subarray(ciphertextEnd)
  const key = pbkdf2Sync(passphrase, salt, ITERATIONS, 32, 'sha256')
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    try {
      writeFileSync(output, plaintext, { flag: 'wx', mode: 0o600 })
    } finally {
      plaintext.fill(0)
    }
  } finally {
    key.fill(0)
  }
}

const [mode, inputName, outputName] = process.argv.slice(2)
if (!['encrypt', 'decrypt'].includes(mode) || !inputName || !outputName) usage()
const inputPath = resolve(inputName)
const outputPath = resolve(outputName)
if (inputPath === outputPath) throw new Error('Input and output paths must differ')
const input = readFileSync(inputPath)
const passphrase = requiredPassphrase()
try {
  if (mode === 'encrypt') encrypt(input, outputPath, passphrase)
  else decrypt(input, outputPath, passphrase)
} finally {
  input.fill(0)
}
