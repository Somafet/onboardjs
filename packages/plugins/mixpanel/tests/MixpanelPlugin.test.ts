import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MixpanelPlugin } from '../src/MixpanelPlugin';
import { MixpanelPluginConfig } from '../src/types';

// Mock mixpanel-browser
const mockMixpanel = {
  init: vi.fn(),
  track: vi.fn(),
  people: {
    set: vi.fn(),
  },
};

// Mock the global mixpanel object
global.mixpanel = mockMixpanel;

describe('MixpanelPlugin', () => {
  let plugin: MixpanelPlugin<any>;
  let config: MixpanelPluginConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    
    config = {
      token: 'test-token',
      debug: true,
    };
    
    plugin = new MixpanelPlugin(config);
  });

  it('should be created with correct name and version', () => {
    expect(plugin.name).toBe("@onboardjs/mixpanel-plugin");
    expect(plugin.version).toBe('1.0.0');
    expect(plugin.description).toBe('Official Mixpanel analytics plugin for OnboardJS');
  });

  it('should be created successfully', () => {
    expect(plugin).toBeDefined();
    expect(plugin).toBeInstanceOf(MixpanelPlugin);
  });
});
