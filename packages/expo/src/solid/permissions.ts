import { createMemo, createSignal, type Accessor } from 'solid-js';
import { ownedRequests } from './owned.ts';

export interface PermissionResponse {
  readonly status: 'granted' | 'denied' | 'undetermined';
  readonly granted: boolean;
  readonly canAskAgain: boolean;
}
export interface PermissionApi {
  get(): Promise<PermissionResponse>;
  request(): Promise<PermissionResponse>;
}

/** Owner-bound permission state; newer requests always outrank older snapshots. */
export class Permission {
  readonly status: Accessor<PermissionResponse['status'] | 'unknown'>;
  readonly granted: Accessor<boolean>;
  readonly blocked: Accessor<boolean>;
  private readonly requests = ownedRequests();
  private readonly api: PermissionApi;
  private readonly last;
  private readonly setLast;
  private revision = 0;

  constructor(api: PermissionApi) {
    this.api = api;
    [this.last, this.setLast] = createSignal<PermissionResponse | null>(null);
    this.status = createMemo(() => this.last()?.status ?? 'unknown');
    this.granted = createMemo(() => this.last()?.granted ?? false);
    this.blocked = createMemo(() => {
      const response = this.last();
      return !!response && !response.granted && !response.canAskAgain;
    });
  }
  static of(get: PermissionApi['get'], request: PermissionApi['request']): Permission {
    return new Permission({ get, request });
  }
  check(): Promise<boolean> {
    return this.read(() => this.api.get());
  }
  request(): Promise<boolean> {
    return this.read(() => this.api.request());
  }
  ensure(): Promise<boolean> {
    return this.requests.run(false, async (active) => {
      if (this.last() === null) await this.check();
      if (!active()) return false;
      const current = this.last();
      if (current?.granted) return true;
      if (current && !current.canAskAgain) return false;
      return this.request();
    });
  }
  private read(start: () => Promise<PermissionResponse>): Promise<boolean> {
    const revision = ++this.revision;
    return this.requests
      .run<PermissionResponse | null>(null, start, (response) => {
        if (response && revision === this.revision) this.setLast(response);
      })
      .then((response) => response?.granted ?? false);
  }
}
