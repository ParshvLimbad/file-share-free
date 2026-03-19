import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_KEY = '@transfer_history';
const MAX_HISTORY = 100;

export interface TransferRecord {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  direction: 'sent' | 'received';
  timestamp: number;
  uri?: string; // For received files
}

export async function getTransferHistory(): Promise<TransferRecord[]> {
  try {
    const data = await AsyncStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function addTransferRecord(
  record: Omit<TransferRecord, 'id' | 'timestamp'>
): Promise<void> {
  try {
    const history = await getTransferHistory();
    const newRecord: TransferRecord = {
      ...record,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    history.unshift(newRecord);

    // Keep only the last MAX_HISTORY records
    if (history.length > MAX_HISTORY) {
      history.splice(MAX_HISTORY);
    }

    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('Failed to save transfer record:', error);
  }
}

export async function clearTransferHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
  } catch (error) {
    console.error('Failed to clear transfer history:', error);
  }
}

export async function getDailyUsage(): Promise<number> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const key = `@daily_usage_${today}`;
    const data = await AsyncStorage.getItem(key);
    return data ? parseInt(data, 10) : 0;
  } catch {
    return 0;
  }
}

export async function addDailyUsage(bytes: number): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const key = `@daily_usage_${today}`;
    const current = await getDailyUsage();
    await AsyncStorage.setItem(key, String(current + bytes));
  } catch (error) {
    console.error('Failed to update daily usage:', error);
  }
}

export async function getBonusBytes(): Promise<number> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const key = `@bonus_bytes_${today}`;
    const data = await AsyncStorage.getItem(key);
    return data ? parseInt(data, 10) : 0;
  } catch {
    return 0;
  }
}

export async function addBonusBytes(bytes: number): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const key = `@bonus_bytes_${today}`;
    const current = await getBonusBytes();
    await AsyncStorage.setItem(key, String(current + bytes));
  } catch (error) {
    console.error('Failed to update bonus bytes:', error);
  }
}
