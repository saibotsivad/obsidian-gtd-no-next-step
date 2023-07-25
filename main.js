const { Notice, Plugin, PluginSettingTab, Setting } = require('obsidian')

const DEFAULT_SETTINGS = {
	nextStepTag: 'next-step',
	waitingForTag: 'waiting-for',
	projectsFolderPrefix: 'Projects',
	projectFileCache: {
		// ['Projects/example.md']: { mtime: 123, hasNextStep: true }
	},
}

const makeTaskRegex = tagString => new RegExp(`^\\s*-\\s{1,2}\\[\\s]\\s.*#${tagString}[\\W]*`, 'm')

module.exports = class GtdNoNextStep extends Plugin {
	async onload() {
		await this.loadSettings()
		this.nextStepTagRegex = makeTaskRegex(this.settings.nextStepTag)
		this.waitingForTagRegex = makeTaskRegex(this.settings.waitingForTag)

		this.registerEvent(this.app.vault.on('delete', async () => { await this.refreshBadges() }))
		this.registerEvent(this.app.vault.on('rename', async () => { await this.refreshBadges() }))
		this.registerEvent(this.app.vault.on('modify', async () => { await this.refreshBadges() }))

		this.app.workspace.onLayoutReady(this.initialize)
		this.addSettingTab(new SettingTab(this.app, this))
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
	}

	async saveSettings() {
		await this.saveData(this.settings || DEFAULT_SETTINGS)
	}

	isProjectFile = filename => filename.startsWith(this.settings.projectsFolderPrefix)
		&& filename.endsWith('.md')
		&& !filename.includes('/_')

	containsIncompleteNextStep = string => this.nextStepTagRegex.test(string)
	containsIncompleteWaitingFor = string => this.waitingForTagRegex.test(string)

	refreshBadges = async () => {
		const projectFilesList = this
			.app
			.vault
			.getMarkdownFiles()
			.filter(f => this.isProjectFile(f.path))
		const filesMap = {}
		let needToSave = false
		for (const file of projectFilesList) {
			filesMap[file.path] = this.settings.projectFileCache[file.path] || {
				mtime: file.stat.mtime,
			}
			const lastCache = this.settings.projectFileCache[file.path]
			if (file.stat.mtime > (lastCache ? lastCache.mtime : 0)) {
				needToSave = true
				const string = await this.app.vault.read(file)
				filesMap[file.path].nextStep = this.containsIncompleteNextStep(string)
				filesMap[file.path].waitingFor = this.containsIncompleteWaitingFor(string)
				console.log('--', file.path, filesMap[file.path])
			}
		}
		for (const path in this.settings.projectFileCache)
			if (!filesMap[path]) needToSave = true
		if (needToSave) {
			this.settings.projectFileCache = filesMap
			await this.saveSettings()
		}
		// update badge class
		const leaves = this.app.workspace.getLeavesOfType('file-explorer')
		if (!leaves.length) console.error('Tobias says: I saw in one plugin that this might not load right away, so they added retry logic with a setTimeout')
		else {
			const fileItems = leaves[0].view.fileItems
			for (const f in fileItems) if (this.isProjectFile(f)) {
				const cached = filesMap[f]
				if (cached && !cached.nextStep && !cached.waitingFor) {
					fileItems[f].coverEl.addClass('gtd-no-next-step')
				} else if (cached && cached.waitingFor) {
					fileItems[f].coverEl.removeClass('gtd-no-next-step')
					fileItems[f].coverEl.addClass('gtd-waiting-for')
				} else {
					fileItems[f].coverEl.removeClass('gtd-no-next-step')
					fileItems[f].coverEl.removeClass('gtd-waiting-for')
				}
			}
		}
	}

	initialize = () => { this.refreshBadges() }
}

class SettingTab extends PluginSettingTab {
	constructor(app, plugin) {
		super(app, plugin)
		this.plugin = plugin
	}
	display() {
		const { containerEl } = this
		containerEl.empty()
		new Setting(containerEl)
			.setName('Projects Folder')
			.setDesc('The prefix for project files, e.g. for a folder use "Projects/".')
			.addText(
				text => text
					.setPlaceholder('Projects/')
					.setValue(this.plugin.settings.projectsFolderPrefix)
					.onChange(async (value) => {
						this.plugin.settings.projectsFolderPrefix = value
						await this.plugin.saveSettings()
					})
			)
		new Setting(containerEl)
			.setName('Next-Step Tag')
			.setDesc('The tag (without #) that indicates a task has a next step.')
			.addText(
				text => text
					.setPlaceholder('next-step')
					.setValue(this.plugin.settings.nextStepTag)
					.onChange(async (value) => {
						this.plugin.settings.nextStepTag = value
						await this.plugin.saveSettings()
					})
			)
		new Setting(containerEl)
			.setName('Waiting-For Tag')
			.setDesc('The tag (without #) that indicates a task is waiting for an external action.')
			.addText(
				text => text
					.setPlaceholder('waiting-for')
					.setValue(this.plugin.settings.waitingForTag)
					.onChange(async (value) => {
						this.plugin.settings.waitingForTag = value
						await this.plugin.saveSettings()
					})
			)
	}
}
