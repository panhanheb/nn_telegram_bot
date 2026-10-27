import { db } from '../../utils/db'

export default defineEventHandler(async () => {
  const setupRequired = await db.isSetupRequired()
  return {
    setupRequired
  }
})
