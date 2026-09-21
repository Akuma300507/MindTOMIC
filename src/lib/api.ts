import type {
  AppDatabase,
  Participant,
  Topic,
  EventImage,
  CustomFieldDefinition,
  EventSettings,
  EventLog,
  LiveSyncState,
  StationState,
  ProjectorDevice,
} from '../types';
import { getServerNow, recordServerTimestamp } from './timeSync';

// Scoped fetch wrapper attaching unique projector device ID header if present in localStorage
const nativeFetch = typeof window !== 'undefined' ? window.fetch.bind(window) : globalThis.fetch;
const fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const headers = new Headers(init?.headers);
  try {
    const projId = typeof localStorage !== 'undefined' ? localStorage.getItem('projector_device_id') : null;
    if (projId && !headers.has('x-projector-device-id')) {
      headers.set('x-projector-device-id', projId);
    }
  } catch {}
  return nativeFetch(input, { ...init, headers });
};

export const api = {
  // Health
  async getHealth() {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (data?.serverTime) recordServerTimestamp(data.serverTime);
    return data;
  },

  // State
  async getState(): Promise<AppDatabase> {
    const res = await fetch('/api/state');
    if (!res.ok) throw new Error('Failed to load database state');
    return res.json();
  },

  async resetData(): Promise<{ success: boolean; message: string; db: AppDatabase }> {
    const res = await fetch('/api/reset-data', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reset database');
    return res.json();
  },

  // RESET ALL STATUSES (Master / Admin)
  async resetAllStatuses(): Promise<{ success: boolean; message: string; db: AppDatabase }> {
    const res = await fetch('/api/event/reset-all-statuses', { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to reset all statuses');
    }
    return res.json();
  },

  // Stations
  async getStations(): Promise<StationState[]> {
    const res = await fetch('/api/stations');
    if (!res.ok) throw new Error('Failed to fetch stations');
    return res.json();
  },

  async getStation(id: string): Promise<StationState> {
    const res = await fetch(`/api/stations/${id}`);
    if (!res.ok) throw new Error('Failed to fetch station');
    return res.json();
  },

  async claimStation(id: string, deviceId: string, deviceName?: string, force?: boolean): Promise<{ success?: boolean; conflict?: boolean; currentDeviceName?: string; station?: StationState; message?: string }> {
    const res = await fetch(`/api/stations/${id}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, deviceName, force }),
    });
    if (res.status === 409) {
      return res.json();
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || 'Failed to claim station');
    }
    return res.json();
  },

  async heartbeatStation(id: string, deviceId: string, deviceName?: string): Promise<void> {
    await fetch(`/api/stations/${id}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, deviceName }),
    }).catch(() => {});
  },

  async releaseStation(id: string, deviceId: string): Promise<void> {
    await fetch(`/api/stations/${id}/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    }).catch(() => {});
  },

  async setStationRound(id: string, round: 1 | 2 | 3, force?: boolean): Promise<{ success: boolean; station: StationState }> {
    const res = await fetch(`/api/stations/${id}/set-round`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ round, force }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to set station round');
    }
    return res.json();
  },

  async setEventRound(
    round: 1 | 2 | 3,
    force?: boolean
  ): Promise<{
    success: boolean;
    currentRound: 1 | 2 | 3;
    round2PermissionGranted?: boolean;
    round3PermissionGranted?: boolean;
    stations: Record<string, StationState>;
  }> {
    const res = await fetch('/api/event/set-round', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ round, force }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to advance competition round');
    }
    return res.json();
  },

  async grantStagePermission(
    targetRound: 2 | 3,
    markAbsent = true,
    force = false
  ): Promise<{
    success: boolean;
    message?: string;
    currentRound: 2 | 3;
    markedAbsentCount: number;
    round2PermissionGranted?: boolean;
    round3PermissionGranted?: boolean;
    stations: Record<string, StationState>;
  }> {
    const res = await fetch('/api/event/stage-permission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetRound, markAbsent, force }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to grant stage permission for Round ${targetRound}`);
    }
    return res.json();
  },

  async getRoundStatus(): Promise<{
    currentRound: 1 | 2 | 3;
    round2PermissionGranted?: boolean;
    round3PermissionGranted?: boolean;
    stagePermissions?: Record<string, any>;
    rounds: Record<1 | 2 | 3, any>;
  }> {
    const res = await fetch('/api/event/round-status');
    if (!res.ok) throw new Error('Failed to fetch round status');
    return res.json();
  },

  async updateStationHandler(id: string, data: {
    handlerName?: string | null;
    handlerPhone?: string | null;
    handlerRole?: string | null;
    handlerStatus?: 'active' | 'ready' | 'on_break' | 'busy' | 'away';
    handlerNotes?: string | null;
    name?: string;
    location?: string;
  }): Promise<{ success: boolean; station: StationState }> {
    const res = await fetch(`/api/stations/${id}/handler`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update station handler');
    return res.json();
  },

  async pingStation(id: string, senderName?: string, message?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/stations/${id}/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderName, message }),
    });
    if (!res.ok) throw new Error('Failed to ping station');
    return res.json();
  },

  async setStationParticipant(id: string, participantId: string | null): Promise<{ success: boolean; station: StationState }> {
    const res = await fetch(`/api/stations/${id}/set-participant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId }),
    });
    if (!res.ok) throw new Error('Failed to set station participant');
    return res.json();
  },

  async assignStationImage(id: string, participantId?: string, participantName?: string, slotIndex?: number, imageId?: string): Promise<{ success: boolean; image: EventImage; station: StationState; slotIndex?: number }> {
    const res = await fetch(`/api/stations/${id}/assign-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, participantName, slotIndex, imageId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to assign station image');
    }
    return res.json();
  },

  async rotateStationImage(id: string, rotation?: number): Promise<{ success: boolean; station: StationState; imageRotation: number }> {
    const res = await fetch(`/api/stations/${id}/rotate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rotation }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to rotate station image');
    }
    return res.json();
  },

  async spinStationTopic(id: string, participantId?: string, participantName?: string, wheelTopicIds?: string[], slotIndex?: number): Promise<{ success: boolean; topic: Topic; targetIndex?: number; wheelTopics?: Topic[]; startedAt: number; durationMs: number; station: StationState; slotIndex?: number }> {
    const res = await fetch(`/api/stations/${id}/spin-topic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, participantName, wheelTopicIds, slotIndex }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to spin topic');
    }
    return res.json();
  },

  async getSynchronizedSlots(): Promise<{ success: boolean; synchronizedSlots: { round1: Record<number, string>; round2: Record<number, string> } }> {
    const res = await fetch('/api/slots');
    if (!res.ok) throw new Error('Failed to fetch synchronized slots');
    return res.json();
  },

  async resetSynchronizedSlots(round?: 'round1' | 'round2' | 'all'): Promise<{ success: boolean; synchronizedSlots: { round1: Record<number, string>; round2: Record<number, string> } }> {
    const res = await fetch('/api/slots/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ round }),
    });
    if (!res.ok) throw new Error('Failed to reset synchronized slots');
    return res.json();
  },

  async pregenerateSynchronizedSlots(count: number = 60, round?: 'round1' | 'round2' | 'all'): Promise<{ success: boolean; synchronizedSlots: { round1: Record<number, string>; round2: Record<number, string> } }> {
    const res = await fetch('/api/slots/pregenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count, round }),
    });
    if (!res.ok) throw new Error('Failed to pre-generate synchronized slots');
    return res.json();
  },

  async completeStationSpin(id: string): Promise<{ success: boolean; station: StationState }> {
    const res = await fetch(`/api/stations/${id}/spin-complete`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to complete spin transition');
    return res.json();
  },

  async replaceStationWheelTopic(
    id: string,
    usedTopicId: string,
    replacementTopicId?: string
  ): Promise<{ success: boolean; station: StationState; activeWheelTopics: Topic[] }> {
    const res = await fetch(`/api/stations/${id}/wheel-replace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usedTopicId, replacementTopicId }),
    });
    if (!res.ok) throw new Error('Failed to replace wheel topic');
    return res.json();
  },

  async sendStationTimerAction(id: string, payload: {
    action: 'start' | 'pause' | 'stop' | 'stop_with_buzzer' | 'reset' | 'time_up' | 'transition_to_speech';
    phase?: 'prep' | 'speech' | 'stopped' | 'idle' | 'time_up';
    totalSeconds?: number;
    remainingSeconds?: number;
    round?: string;
    endsAt?: number;
    startedAt?: number;
  }): Promise<{ success: boolean; station: StationState; serverTime?: number }> {
    const finalPayload = {
      ...payload,
      startedAt: payload.action === 'start' ? (payload.startedAt || getServerNow()) : payload.startedAt,
    };
    const res = await fetch(`/api/stations/${id}/timer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalPayload),
    });
    if (!res.ok) throw new Error('Failed to send station timer action');
    const data = await res.json();
    if (data?.serverTime) recordServerTimestamp(data.serverTime);
    return data;
  },

  // Participants
  async getParticipants(): Promise<Participant[]> {
    const res = await fetch('/api/participants');
    if (!res.ok) throw new Error('Failed to fetch participants');
    return res.json();
  },

  async addParticipant(p: Partial<Participant>): Promise<Participant> {
    const res = await fetch('/api/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
    if (!res.ok) throw new Error('Failed to create participant');
    return res.json();
  },

  async updateParticipant(id: string, p: Partial<Participant>): Promise<Participant> {
    const res = await fetch(`/api/participants/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
    if (!res.ok) throw new Error('Failed to update participant');
    return res.json();
  },

  async deleteParticipant(id: string): Promise<void> {
    const res = await fetch(`/api/participants/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete participant');
  },

  async deleteAllParticipants(): Promise<void> {
    const res = await fetch('/api/participants', { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete all participants');
  },

  async batchAddParticipants(participants: Partial<Participant>[]): Promise<{ count: number; participants: Participant[] }> {
    const res = await fetch('/api/participants/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participants }),
    });
    if (!res.ok) throw new Error('Failed to import participants batch');
    return res.json();
  },

  async batchSetStation(participantIds: string[], stationId: string, stationName?: string, forRound?: 1 | 2 | 3): Promise<{ success: boolean; count: number; participants: Participant[] }> {
    const res = await fetch('/api/participants/station/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantIds, stationId, stationName, forRound }),
    });
    if (!res.ok) throw new Error('Failed to batch update participant station');
    return res.json();
  },

  async moveParticipantStation(id: string, stationId: string, stationName?: string, forRound?: 1 | 2 | 3): Promise<{ success: boolean; participant: Participant }> {
    const res = await fetch(`/api/participants/${id}/move-station`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stationId, stationName, forRound }),
    });
    if (!res.ok) throw new Error('Failed to move participant station');
    return res.json();
  },

  async checkInParticipant(
    id: string,
    options?: { checkedIn?: boolean; stationId?: string; stationName?: string; checkedInBy?: string }
  ): Promise<{ success: boolean; participant: Participant }> {
    const res = await fetch(`/api/participants/${id}/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {}),
    });
    if (!res.ok) throw new Error('Failed to update participant check-in status');
    return res.json();
  },

  async batchCheckInParticipants(
    participantIds: string[],
    options?: { checkedIn?: boolean; stationId?: string; stationName?: string; checkedInBy?: string }
  ): Promise<{ success: boolean; count: number; participants: Participant[] }> {
    const res = await fetch('/api/participants/check-in/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantIds, ...(options || {}) }),
    });
    if (!res.ok) throw new Error('Failed to batch check in participants');
    return res.json();
  },

  // Custom Fields
  async getCustomFields(): Promise<CustomFieldDefinition[]> {
    const res = await fetch('/api/custom-fields');
    if (!res.ok) throw new Error('Failed to fetch custom fields');
    return res.json();
  },

  async addCustomField(field: Partial<CustomFieldDefinition>): Promise<CustomFieldDefinition> {
    const res = await fetch('/api/custom-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(field),
    });
    if (!res.ok) throw new Error('Failed to add custom field');
    return res.json();
  },

  async updateCustomField(id: string, field: Partial<CustomFieldDefinition>): Promise<CustomFieldDefinition> {
    const res = await fetch(`/api/custom-fields/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(field),
    });
    if (!res.ok) throw new Error('Failed to update custom field');
    return res.json();
  },

  async deleteCustomField(id: string): Promise<void> {
    const res = await fetch(`/api/custom-fields/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete custom field');
    }
  },

  // Topics
  async getTopics(): Promise<Topic[]> {
    const res = await fetch('/api/topics');
    if (!res.ok) throw new Error('Failed to fetch topics');
    return res.json();
  },

  async addTopic(t: { topic: string; category?: string; topicId?: string; stationId?: string; stationName?: string }): Promise<Topic> {
    const res = await fetch('/api/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(t),
    });
    if (!res.ok) throw new Error('Failed to add topic');
    return res.json();
  },

  async updateTopic(id: string, t: Partial<Topic>): Promise<Topic> {
    const res = await fetch(`/api/topics/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(t),
    });
    if (!res.ok) throw new Error('Failed to update topic');
    return res.json();
  },

  async deleteTopic(id: string): Promise<void> {
    const res = await fetch(`/api/topics/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete topic');
  },

  async deleteAllTopics(): Promise<void> {
    const res = await fetch('/api/topics', { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete all topics');
  },

  async batchAddTopics(topics: { topic: string; category?: string; topicId?: string; stationId?: string; stationName?: string }[], stationId?: string): Promise<{ count: number; topics: Topic[] }> {
    const res = await fetch('/api/topics/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topics, stationId }),
    });
    if (!res.ok) throw new Error('Failed to batch import topics');
    return res.json();
  },

  async batchUpdateTopicStations(
    topicIds: string[],
    stationId?: string,
    stationName?: string
  ): Promise<{ success: boolean; count: number; topics: Topic[]; allTopics: Topic[] }> {
    const res = await fetch('/api/topics/batch-station', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicIds, stationId, stationName }),
    });
    if (!res.ok) throw new Error('Failed to update topic stations');
    return res.json();
  },

  async resetTopicsStatus(): Promise<void> {
    const res = await fetch('/api/topics/reset-status', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reset topics');
  },

  // Images
  async getImages(): Promise<EventImage[]> {
    const res = await fetch('/api/images');
    if (!res.ok) throw new Error('Failed to fetch images');
    return res.json();
  },

  async addImage(img: { name?: string; imageId?: string; url: string; stationId?: string; stationName?: string }): Promise<EventImage> {
    const res = await fetch('/api/images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(img),
    });
    if (!res.ok) throw new Error('Failed to add image');
    return res.json();
  },

  async updateImage(id: string, updates: Partial<EventImage>): Promise<EventImage> {
    const res = await fetch(`/api/images/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update image');
    return res.json();
  },

  async uploadImages(payload: {
    images?: Array<{ imageId?: string; name?: string; base64: string; stationId?: string; stationName?: string }>;
    name?: string;
    base64?: string;
    imageId?: string;
    stationId?: string;
    stationName?: string;
  }): Promise<{ success: boolean; count: number; images: EventImage[]; allImages: EventImage[] }> {
    const res = await fetch('/api/images/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to upload image(s)');
    }
    return res.json();
  },

  async batchUpdateImageStations(
    imageIds: string[],
    stationId?: string,
    stationName?: string
  ): Promise<{ success: boolean; count: number; images: EventImage[]; allImages: EventImage[] }> {
    const res = await fetch('/api/images/batch-station', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageIds, stationId, stationName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to reassign images');
    }
    return res.json();
  },

  async deleteImage(id: string): Promise<void> {
    const res = await fetch(`/api/images/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete image');
  },

  async deleteAllImages(): Promise<void> {
    const res = await fetch('/api/images', { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete all images');
  },

  async resetImagesStatus(): Promise<void> {
    const res = await fetch('/api/images/reset-status', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reset images');
  },

  // Settings
  async getSettings(): Promise<EventSettings> {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  async updateSettings(settings: Partial<EventSettings>): Promise<EventSettings> {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to save settings');
    return res.json();
  },

  // History
  async getHistory(): Promise<EventLog[]> {
    const res = await fetch('/api/history');
    if (!res.ok) throw new Error('Failed to fetch history');
    return res.json();
  },

  async logAction(action: string, details: string, round?: 'Round 1' | 'Round 2' | 'Round 3' | 'General', participantId?: string, participantName?: string) {
    await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, details, round, participantId, participantName }),
    }).catch(() => {});
  },

  async clearHistory(): Promise<void> {
    const res = await fetch('/api/history', { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clear history');
  },

  // Results
  async getResults(): Promise<{ round1: any[]; round2: any[]; round3: any[] }> {
    const res = await fetch('/api/results');
    if (!res.ok) throw new Error('Failed to fetch results');
    return res.json();
  },

  async saveRound1Result(result: any) {
    const res = await fetch('/api/results/round1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    });
    return res.json();
  },

  async saveRound2Result(result: any) {
    const res = await fetch('/api/results/round2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    });
    return res.json();
  },

  async saveRound3Result(result: any) {
    const res = await fetch('/api/results/round3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    });
    return res.json();
  },

  // Qualification
  async updateQualification(payload: {
    participantId: string;
    round: 1 | 2 | 3;
    status: 'qualified' | 'disqualified' | 'pending';
    reason?: string;
  }): Promise<{ success: boolean; participant: Participant }> {
    const res = await fetch('/api/qualification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update qualification');
    }
    return res.json();
  },

  async batchUpdateQualification(payload: {
    participantIds: string[];
    round: 1 | 2 | 3;
    status: 'qualified' | 'disqualified' | 'pending';
  }): Promise<{ success: boolean; count: number; participants: Participant[] }> {
    const res = await fetch('/api/qualification/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to batch update qualification');
    }
    return res.json();
  },

  // Buzzer Trigger
  async triggerBuzzer(payload: { source?: string; reason?: string; round?: string; participantName?: string; stationId?: string }) {
    const res = await fetch('/api/buzzer/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  // Live Sync
  async updateLiveSync(state: Partial<LiveSyncState>) {
    const res = await fetch('/api/live-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    return res.json();
  },

  // Synchronized Timer Action
  async sendTimerAction(payload: {
    action: 'start' | 'pause' | 'stop' | 'reset' | 'time_up' | 'transition_to_speech' | 'stop_with_buzzer';
    phase?: 'prep' | 'speech' | 'stopped' | 'idle' | 'time_up';
    totalSeconds?: number;
    remainingSeconds?: number;
    round?: string;
    endsAt?: number;
    startedAt?: number;
  }) {
    const finalPayload = {
      ...payload,
      startedAt: payload.action === 'start' ? (payload.startedAt || getServerNow()) : payload.startedAt,
    };
    const res = await fetch('/api/timer/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalPayload),
    });
    const data = await res.json();
    if (data?.serverTime) recordServerTimestamp(data.serverTime);
    return data;
  },

  // Atomic Round 1 Image Assignment
  async assignRound1Image(payload: {
    participantId?: string;
    participantName?: string;
    stationId?: string;
  }) {
    const res = await fetch('/api/round1/assign-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to assign image');
    }
    return res.json();
  },

  // Atomic Round 2 Topic Spin
  async spinRound2Topic(payload: {
    participantId?: string;
    participantName?: string;
    stationId?: string;
    wheelTopicIds?: string[];
  }) {
    const res = await fetch('/api/round2/spin-topic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to spin topic');
    }
    return res.json();
  },

  // Custom Buzzer Audio
  async uploadCustomBuzzer(audioData: string, fileName?: string) {
    const res = await fetch('/api/buzzer/custom-sound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioData, fileName }),
    });
    if (!res.ok) throw new Error('Failed to upload buzzer audio');
    return res.json();
  },

  async resetCustomBuzzer() {
    const res = await fetch('/api/buzzer/custom-sound', { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to reset custom buzzer');
    return res.json();
  },

  // Custom 30s Preparation Timer Buzzer Audio
  async uploadCustomPrepBuzzer(audioData: string, fileName?: string) {
    const res = await fetch('/api/buzzer/prep-custom-sound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioData, fileName }),
    });
    if (!res.ok) throw new Error('Failed to upload prep buzzer audio');
    return res.json();
  },

  async resetCustomPrepBuzzer() {
    const res = await fetch('/api/buzzer/prep-custom-sound', { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to reset prep buzzer');
    return res.json();
  },

  // Custom Mid-Round Timing Warning Buzzer Audio
  async uploadCustomWarningBuzzer(audioData: string, fileName?: string) {
    const res = await fetch('/api/buzzer/warning-custom-sound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioData, fileName }),
    });
    if (!res.ok) throw new Error('Failed to upload warning buzzer audio');
    return res.json();
  },

  async resetCustomWarningBuzzer() {
    const res = await fetch('/api/buzzer/warning-custom-sound', { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to reset warning buzzer');
    return res.json();
  },

  // Custom Official Logo Management
  async uploadCustomLogo(logoData: string, fileName?: string) {
    const res = await fetch('/api/settings/logo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logoData, fileName }),
    });
    if (!res.ok) throw new Error('Failed to upload custom logo');
    return res.json();
  },

  async resetCustomLogo() {
    const res = await fetch('/api/settings/logo', { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to reset logo');
    return res.json();
  },

  // Inspire 2K26 Logo Management
  async uploadInspireLogo(logoData: string, fileName?: string) {
    const res = await fetch('/api/settings/inspire-logo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logoData, fileName }),
    });
    if (!res.ok) throw new Error('Failed to upload inspire logo');
    return res.json();
  },

  async resetInspireLogo() {
    const res = await fetch('/api/settings/inspire-logo', { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to reset inspire logo');
    return res.json();
  },

  // Start Fresh Event
  async startNewEvent() {
    const res = await fetch('/api/event/start-new', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to start new event');
    return res.json();
  },

  // Projector Display Devices
  async getConnectedProjectors(): Promise<ProjectorDevice[]> {
    const res = await fetch('/api/projectors');
    if (!res.ok) throw new Error('Failed to fetch connected projectors');
    const data = await res.json();
    return Array.isArray(data) ? data : (data?.projectors || []);
  },

  async assignProjectorStation(deviceId: string, stationId: string): Promise<{ success: boolean; projector?: ProjectorDevice }> {
    const res = await fetch(`/api/projectors/${deviceId}/assign-station`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stationId }),
    });
    if (!res.ok) throw new Error('Failed to assign station to projector');
    return res.json();
  },

  async pingProjectorDevice(deviceId: string, message?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/projectors/${deviceId}/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error('Failed to ping projector');
    return res.json();
  },

  // Sync / Restore local additions to server if missing on server
  async syncRestore(payload: {
    participants?: Participant[];
    topics?: Topic[];
    images?: EventImage[];
    clientResetAt?: number;
  }): Promise<{ success: boolean; message?: string; ignored?: boolean; reason?: string }> {
    const res = await fetch('/api/sync-restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to sync local additions to server');
    return res.json();
  },
};

