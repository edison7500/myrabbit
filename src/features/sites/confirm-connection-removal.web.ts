export async function confirmConnectionRemoval(serverUrl: string): Promise<boolean> {
  return window.confirm(`Remove saved connection?\n\nRemove the saved API URL and API key for ${serverUrl} from MyRabbit in this browser session? Your Rybbit sites and analytics data will be kept.`);
}
