import { APP_NAME } from "@symlink/shared";

export function Greeting({ platform }: { platform: string }) {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<div className="text-center">
				<h1 className="text-4xl font-bold">{APP_NAME}</h1>
				<p className="mt-2 text-lg text-gray-500">Running on {platform}</p>
			</div>
		</div>
	);
}
