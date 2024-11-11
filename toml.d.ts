// toml.d.ts
declare module "*.toml" {
	const value: Record<string, any>
	export default value
}
