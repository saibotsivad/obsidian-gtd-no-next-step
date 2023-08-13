const { Notice, Plugin, PluginSettingTab, Setting } = require('obsidian')

const DEFAULT_SETTINGS = {
	nextStepTag: '#next-step',
	waitingForTag: '#waiting-for',
	projectsFolderPrefix: 'Projects/',
	projectFileCache: {
		// ['Projects/example.md']: { mtime: 123, nextStep: true, waitingFor: true }
	},
}

const makeTaskRegex = tagString => new RegExp(`^\\s*-\\s{1,2}\\[\\s]\\s.*${tagString}[\\W]*`, 'm')

const updateFileBadges = (file, fileItem, isProjectFile) => {
	const { nextStep, waitingFor } = file || {}
	if (isProjectFile && !nextStep && !waitingFor) {
		fileItem.coverEl.addClass('gtd-no-next-step')
	} else if (isProjectFile && file.waitingFor) {
		fileItem.coverEl.removeClass('gtd-no-next-step')
		fileItem.coverEl.addClass('gtd-waiting-for')
	} else {
		fileItem.coverEl.removeClass('gtd-no-next-step')
		fileItem.coverEl.removeClass('gtd-waiting-for')
	}
}

module.exports = class MyPlugin extends Plugin {
	async onload() {
		await this.loadSettings()
		// TODO make lazy
		this.nextStepTagRegex = makeTaskRegex(this.settings.nextStepTag)
		this.waitingForTagRegex = makeTaskRegex(this.settings.waitingForTag)

		this.registerEvent(this.app.vault.on('delete', async event => { await this.refreshFileBadges(event) }))
		this.registerEvent(this.app.vault.on('rename', async event => { await this.refreshFileBadges(event) }))
		this.registerEvent(this.app.vault.on('modify', async event => { await this.refreshFileBadges(event) }))

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

	refreshFileBadges = async ({ path, stat, deleted, ...remaining }) => {
		const cached = this.settings.projectFileCache[path] || {}
		const pathIsProjectFile = this.isProjectFile(path)
		let needToSave
		let removeBadges
		if (!deleted && pathIsProjectFile) {
			const string = await this.app.vault.cachedRead(
				this.app.vault.getAbstractFileByPath(path)
			)
			const nextStep = this.containsIncompleteNextStep(string)
			if (cached?.nextStep !== nextStep) cached.nextStep = nextStep
			const waitingFor = this.containsIncompleteWaitingFor(string)
			if (cached?.waitingFor !== waitingFor) cached.waitingFor = waitingFor
			cached.mtime = stat.mtime
			needToSave = true
		} else if (this.settings.projectFileCache[path]) {
			delete this.settings.projectFileCache[path]
			needToSave = true
		}
		if (needToSave) {
			this.settings.projectFileCache[path] = cached
			await this.saveSettings()
		}
		window.setTimeout(() => {
			const leaves = this.app.workspace.getLeavesOfType('file-explorer')
			if (leaves?.[0]?.view?.fileItems?.[path])
				updateFileBadges(cached, leaves[0].view.fileItems[path], pathIsProjectFile)
		})
	}

	refreshProjectBadges = async () => {
		const projectFilesList = this
			.app
			.vault
			.getMarkdownFiles()
			.filter(f => this.isProjectFile(f.path))
		const filesMap = {}
		let needToSave = false
		for (const tFile of projectFilesList) {
			filesMap[tFile.path] = this.settings.projectFileCache[tFile.path] || {
				mtime: tFile.stat.mtime,
			}
			const lastCache = this.settings.projectFileCache[tFile.path]
			if (tFile.stat.mtime > (lastCache ? lastCache.mtime : 0)) {
				needToSave = true
				const string = await this.app.vault.cachedRead(tFile)
				filesMap[tFile.path].nextStep = this.containsIncompleteNextStep(string)
				filesMap[tFile.path].waitingFor = this.containsIncompleteWaitingFor(string)
			}
		}
		for (const path in this.settings.projectFileCache)
			if (!filesMap[path]) needToSave = true
		if (needToSave) {
			this.settings.projectFileCache = filesMap
			await this.saveSettings()
		}
		const leaves = this.app.workspace.getLeavesOfType('file-explorer')
		if (leaves?.length) {
			const fileItems = leaves[0].view?.fileItems || {}
			for (const f in fileItems) if (this.isProjectFile(f)) {
				updateFileBadges(filesMap[f], fileItems[f], true)
			}
		}
	}

	initialize = () => {
		this.refreshProjectBadges().catch(error => {
			console.error('Unexpected error in "gtd-no-next-step" plugin initialization.', error)
		})
	}
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
			.setName('Projects folder')
			.setDesc('The folder where project files live, e.g. "Projects/".')
			.addText(
				text => text
					.setPlaceholder(DEFAULT_SETTINGS.projectsFolderPrefix)
					.setValue(this.plugin.settings.projectsFolderPrefix)
					.onChange(async (value) => {
						this.plugin.settings.projectsFolderPrefix = value
						await this.plugin.saveSettings()
					})
			)
		new Setting(containerEl)
			.setName('Next-Step tag')
			.setDesc('The tag that indicates a task has a next step.')
			.addText(
				text => text
					.setPlaceholder(DEFAULT_SETTINGS.nextStepTag)
					.setValue(this.plugin.settings.nextStepTag)
					.onChange(async (value) => {
						this.plugin.settings.nextStepTag = value
						await this.plugin.saveSettings()
					})
			)
		new Setting(containerEl)
			.setName('Waiting-For tag')
			.setDesc('The tag that indicates a task is waiting for an external action.')
			.addText(
				text => text
					.setPlaceholder(DEFAULT_SETTINGS.waitingForTag)
					.setValue(this.plugin.settings.waitingForTag)
					.onChange(async (value) => {
						this.plugin.settings.waitingForTag = value
						await this.plugin.saveSettings()
					})
			)
	}
}
