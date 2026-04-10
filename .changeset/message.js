module.exports = {
  async getVersionMessage(releasePlan, _options) {
    const lines = releasePlan.releases.map((r) => `- ${r.name}@${r.newVersion}`)
    return `chore: release packages\n\n${lines.join('\n')}`
  },
}
