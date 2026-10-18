/** Non-sensitive metadata only. The credential belongs in platform secure storage. */
export type RybbitInstance = {
  id: string;
  name?: string;
  baseUrl: string;
  apiKeyRef: string;
};

export type InstanceState = {
  instances: RybbitInstance[];
  activeInstanceId: RybbitInstance['id'] | null;
};
