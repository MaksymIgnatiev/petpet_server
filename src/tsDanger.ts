export function setLogOption(option: LogOption) {
	if (typeof option === "number" && /^\d$/.test(option + "")) {
		switch (+option) {
			// @ts-ignore
			case 4:
				globalOptions.logOptions.cache = true
			// @ts-ignore
			case 3:
				globalOptions.logOptions.params = true
			// @ts-ignore
			case 2:
				globalOptions.logOptions.gif = true
			case 1:
				globalOptions.logOptions.rest = true
				break
			default:
				flagError(`Unknown log level for flag 'l': ${option}'`)
		}
	} else if (typeof option === "string") {
		var values = option.split(/,/g) as UnionToTuple<LogOption>
		for (var prop of values) {
			switch (prop) {
				// @ts-ignore
				case "c":
				// @ts-ignore
				case "cache":
					globalOptions.logOptions.cache = true
				// @ts-ignore
				case "p":
				// @ts-ignore
				case "params":
					globalOptions.logOptions.params = true
				// @ts-ignore
				case "g":
				// @ts-ignore
				case "gif":
					globalOptions.logOptions.gif = true
				case "r":
				// @ts-ignore
				case "rest":
					globalOptions.logOptions.rest = true
					break
				default:
					flagError(`Unknown option for flag 'log: ${prop}'`)
			}
		}
	}
}
