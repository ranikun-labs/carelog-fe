import { handleDevEdgeRequest, type DevEdgeEnv } from './dev-edge';

export default {
  async fetch(request: Request, env: DevEdgeEnv): Promise<Response> {
    return handleDevEdgeRequest(request, env);
  },
};
