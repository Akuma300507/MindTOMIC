import * as XLSX from 'xlsx';
import type { Participant, Topic, AppDatabase, CustomFieldDefinition } from '../types';

export const excelService = {
  // Generate & download participant template
  downloadParticipantTemplate(customFields: CustomFieldDefinition[] = []) {
    const headers: Record<string, string> = {
      'Contestant ID': 'M2M-007',
      'Participant Number': 'M2M-007',
      'Full Name': 'John Doe',
      'Mobile Number': '+91 98765 43210',
      'Station': 'Station A',
      'Status': 'active',
    };

    customFields.forEach((cf) => {
      headers[cf.name] = cf.type === 'checkbox' ? 'true' : cf.options?.[0] || 'Sample Value';
    });

    const ws = XLSX.utils.json_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Participants Template');
    XLSX.writeFile(wb, 'mind_to_mic_participants_template.xlsx');
  },

  // Parse uploaded participant excel file
  async parseParticipantsFile(file: File, customFields: CustomFieldDefinition[] = []): Promise<Partial<Participant>[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet);

          const participants: Partial<Participant>[] = rawRows.map((row, idx) => {
            // Find fields flexibly
            const name = row['Full Name'] || row['Name'] || row['Participant Name'] || row['name'] || `Contestant ${idx + 1}`;
            const participantNumber = row['Contestant ID'] || row['Participant Number'] || row['Number'] || row['ID'] || row['participantNumber'] || `M2M-${String(idx + 1).padStart(3, '0')}`;
            const mobile = row['Mobile Number'] || row['Mobile'] || row['Phone Number'] || row['Phone'] || row['Contact'] || row['mobile'] || row['phone'] || '';
            const status = (row['Status'] || row['status'] || 'active').toLowerCase();

            // Flexible Station Parsing
            const rawStation = row['Station'] || row['Station Name'] || row['Station ID'] || row['station'] || row['stationId'] || '';
            let stationId = '';
            let stationName = '';
            if (rawStation) {
              const sStr = String(rawStation).trim();
              const lower = sStr.toLowerCase();
              if (lower.includes('station a') || lower === 'a' || lower === 'station-a') {
                stationId = 'station-a';
                stationName = 'Station A';
              } else if (lower.includes('station b') || lower === 'b' || lower === 'station-b') {
                stationId = 'station-b';
                stationName = 'Station B';
              } else if (lower.includes('station c') || lower === 'c' || lower === 'station-c') {
                stationId = 'station-c';
                stationName = 'Station C';
              } else if (lower.includes('station d') || lower === 'd' || lower === 'station-d') {
                stationId = 'station-d';
                stationName = 'Station D';
              } else {
                stationId = lower.replace(/[^a-z0-9]/g, '-');
                stationName = sStr;
              }
            }

            const customData: Record<string, any> = {};
            if (mobile) {
              customData.phone = String(mobile).trim();
              customData.mobile = String(mobile).trim();
            }
            customFields.forEach((cf) => {
              if (row[cf.name] !== undefined) {
                let val = row[cf.name];
                if (cf.type === 'checkbox') {
                  val = String(val).toLowerCase() === 'true' || val === 1 || String(val).toLowerCase() === 'yes';
                }
                customData[cf.key] = val;
              }
            });

            return {
              name: String(name),
              participantNumber: String(participantNumber),
              mobile: mobile ? String(mobile).trim() : undefined,
              phone: mobile ? String(mobile).trim() : undefined,
              stationId: stationId || undefined,
              stationName: stationName || undefined,
              status: ['active', 'registered', 'checked_in', 'eliminated', 'completed'].includes(status) ? status : 'active',
              round1Status: 'pending',
              round2Status: 'pending',
              round3Status: 'pending',
              customData,
            };
          });

          resolve(participants);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  },

  // Download topic template
  downloadTopicTemplate() {
    const sample = [
      { 'Topic ID': 'TOP-001', 'Topic': 'Is Artificial Intelligence empowering or replacing human creativity?', 'Category': 'Technology' },
      { 'Topic ID': 'TOP-002', 'Topic': 'The Vanishing Art of Deep Conversation', 'Category': 'Culture' },
      { 'Topic ID': 'TOP-003', 'Topic': 'Why True Courage Requires Vulnerability', 'Category': 'Philosophy' },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Topics Template');
    XLSX.writeFile(wb, 'mind_to_mic_topics_template.xlsx');
  },

  // Parse topics file
  async parseTopicsFile(file: File): Promise<{ topic: string; category?: string; topicId?: string }[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet);

          const topics = rawRows
            .map((row) => ({
              topicId: row['Topic ID'] || row['Topic Id'] || row['ID'] || row['topicId'] ? String(row['Topic ID'] || row['Topic Id'] || row['ID'] || row['topicId']).trim() : undefined,
              topic: String(row['Topic'] || row['topic'] || row['Title'] || '').trim(),
              category: String(row['Category'] || row['category'] || 'General').trim(),
            }))
            .filter((t) => t.topic.length > 0);

          resolve(topics);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  },

  // Export full event report with multiple sheets
  exportFullEventReport(db: AppDatabase) {
    const wb = XLSX.utils.book_new();

    // 1. Participants Sheet
    const pRows = db.participants.map((p) => {
      const row: Record<string, any> = {
        'Participant ID': p.id,
        'Contestant ID': p.participantNumber,
        'Full Name': p.name,
        'Mobile Number': p.mobile || p.phone || p.customData?.mobile || p.customData?.phone || '',
        'Station': p.stationName || (p.stationId ? p.stationId.toUpperCase() : 'Unassigned'),
        'Station ID': p.stationId || '',
        'Status': p.status,
        'Round 1 Image ID': p.round1ImageId || '',
        'Round 1 Status': p.round1Status,
        'Round 1 Qualification': p.round1Qualified || 'pending',
        'Round 2 Topic ID': p.round2TopicId || '',
        'Round 2 Status': p.round2Status,
        'Round 2 Qualification': p.round2Qualified || 'pending',
        'Round 3 Status': p.round3Status,
        'Round 3 Qualification': p.round3Qualified || 'pending',
      };
      db.customFields.forEach((cf) => {
        row[cf.name] = p.customData?.[cf.key] ?? '';
      });
      return row;
    });
    const wsParticipants = XLSX.utils.json_to_sheet(pRows);
    XLSX.utils.book_append_sheet(wb, wsParticipants, 'Participants');

    // 2. Images Sheet
    const imgRows = (db.images || []).map((img) => ({
      'Image ID': img.imageId || img.name || img.id,
      'Status': img.status,
      'Used By Participant ID': img.usedByParticipantId || '',
      'Used By Participant Name': img.usedByParticipantName || '',
      'Used At': img.usedAt || '',
    }));
    const wsImages = XLSX.utils.json_to_sheet(imgRows.length ? imgRows : [{ 'Info': 'No images uploaded' }]);
    XLSX.utils.book_append_sheet(wb, wsImages, 'Images');

    // 3. Topics Sheet
    const tRows = db.topics.map((t) => ({
      'Topic ID': t.topicId || t.id,
      'Topic': t.topic,
      'Category': t.category || 'General',
      'Status': t.status,
      'Used By Participant ID': t.usedByParticipantId || '',
      'Used By Participant Name': t.usedByParticipantName || '',
      'Used At': t.usedAt || '',
    }));
    const wsTopics = XLSX.utils.json_to_sheet(tRows);
    XLSX.utils.book_append_sheet(wb, wsTopics, 'Topics');

    // 4. Round 1 Results Sheet
    const r1Rows = db.round1Results.map((r) => {
      const p = db.participants.find((item) => item.id === r.participantId);
      return {
        'Result ID': r.id,
        'Contestant ID': r.participantNumber || p?.participantNumber || r.participantId,
        'Participant Name': r.participantName,
        'Mobile Number': r.mobile || p?.mobile || p?.phone || p?.customData?.mobile || p?.customData?.phone || '',
        'Image ID': r.imageId || r.imageName || '',
        'Prep Duration (s)': r.prepDurationSeconds,
        'Speech Duration (s)': r.speechDurationSeconds,
        'Status': r.status,
        'Qualification': r.qualification || 'pending',
        'Qualification Reason': r.qualificationReason || '',
        'Start Time': r.startTime,
        'End Time': r.endTime,
        'Notes': r.notes || '',
      };
    });
    const wsR1 = XLSX.utils.json_to_sheet(r1Rows.length ? r1Rows : [{ 'Info': 'No Round 1 results recorded yet' }]);
    XLSX.utils.book_append_sheet(wb, wsR1, 'Round 1 Results');

    // 5. Round 2 Results Sheet
    const r2Rows = db.round2Results.map((r) => {
      const p = db.participants.find((item) => item.id === r.participantId);
      return {
        'Result ID': r.id,
        'Contestant ID': r.participantNumber || p?.participantNumber || r.participantId,
        'Participant Name': r.participantName,
        'Mobile Number': r.mobile || p?.mobile || p?.phone || p?.customData?.mobile || p?.customData?.phone || '',
        'Topic ID': r.topicId || '',
        'Topic': r.topicText || r.topic || '',
        'Prep Duration (s)': r.prepDurationSeconds,
        'Speech Duration (s)': r.speechDurationSeconds,
        'Status': r.status,
        'Qualification': r.qualification || 'pending',
        'Qualification Reason': r.qualificationReason || '',
        'Start Time': r.startTime,
        'End Time': r.endTime,
        'Notes': r.notes || '',
      };
    });
    const wsR2 = XLSX.utils.json_to_sheet(r2Rows.length ? r2Rows : [{ 'Info': 'No Round 2 results recorded yet' }]);
    XLSX.utils.book_append_sheet(wb, wsR2, 'Round 2 Results');

    // 6. Round 3 Results Sheet
    const r3Rows = db.round3Results.map((r) => {
      const p = db.participants.find((item) => item.id === r.participantId);
      return {
        'Result ID': r.id,
        'Contestant ID': r.participantNumber || p?.participantNumber || r.participantId,
        'Participant Name': r.participantName,
        'Mobile Number': r.mobile || p?.mobile || p?.phone || p?.customData?.mobile || p?.customData?.phone || '',
        'Speech Duration (s)': r.speechDurationSeconds,
        'Status': r.status,
        'Championship Status': r.qualification || 'pending',
        'Qualification Reason': r.qualificationReason || '',
        'Start Time': r.startTime,
        'End Time': r.endTime,
        'Notes': r.notes || '',
      };
    });
    const wsR3 = XLSX.utils.json_to_sheet(r3Rows.length ? r3Rows : [{ 'Info': 'No Round 3 results recorded yet' }]);
    XLSX.utils.book_append_sheet(wb, wsR3, 'Round 3 Results');

    // 7. Rank List Sheet
    const rankedList = [...db.participants]
      .map((p) => {
        const r1 = db.round1Results.find((r) => r.participantId === p.id);
        const r2 = db.round2Results.find((r) => r.participantId === p.id);
        const r3 = db.round3Results.find((r) => r.participantId === p.id);

        let score = 0;
        let standing = 'Registered';
        if (p.round3Qualified === 'qualified') {
          score = 500 + (r3?.speechDurationSeconds || 0);
          standing = 'Champion';
        } else if (p.round3Status === 'completed' || r3) {
          score = 400 + (r3?.speechDurationSeconds || 0);
          standing = 'Finalist';
        } else if (p.round2Qualified === 'qualified') {
          score = 300 + (r2?.speechDurationSeconds || 0);
          standing = 'Semi-Finalist (R2 Qualified)';
        } else if (p.round2Status === 'completed' || r2) {
          score = 200 + (r2?.speechDurationSeconds || 0);
          standing = 'Round 2 Participant';
        } else if (p.round1Qualified === 'qualified') {
          score = 100 + (r1?.speechDurationSeconds || 0);
          standing = 'Quarter-Finalist (R1 Qualified)';
        } else if (p.round1Status === 'completed' || r1) {
          score = 50 + (r1?.speechDurationSeconds || 0);
          standing = 'Round 1 Participant';
        }

        return {
          score,
          contestantId: p.participantNumber,
          name: p.name,
          mobile: p.mobile || p.phone || p.customData?.mobile || p.customData?.phone || '',
          standing,
          r1Status: p.round1Qualified || p.round1Status || 'pending',
          r1Duration: r1 ? `${r1.speechDurationSeconds}s` : '—',
          r2Status: p.round2Qualified || p.round2Status || 'pending',
          r2Duration: r2 ? `${r2.speechDurationSeconds}s` : '—',
          r3Status: p.round3Qualified || p.round3Status || 'pending',
          r3Duration: r3 ? `${r3.speechDurationSeconds}s` : '—',
        };
      })
      .sort((a, b) => b.score - a.score);

    const rankRows = rankedList.map((item, idx) => ({
      'Rank': idx + 1,
      'Contestant ID': item.contestantId,
      'Contestant Name': item.name,
      'Mobile Number': item.mobile,
      'Overall Standing': item.standing,
      'Round 1 Status': item.r1Status,
      'Round 1 Duration': item.r1Duration,
      'Round 2 Status': item.r2Status,
      'Round 2 Duration': item.r2Duration,
      'Round 3 Status': item.r3Status,
      'Round 3 Duration': item.r3Duration,
    }));
    const wsRank = XLSX.utils.json_to_sheet(rankRows.length ? rankRows : [{ 'Info': 'No contestants ranked yet' }]);
    XLSX.utils.book_append_sheet(wb, wsRank, 'Rank List');

    // 7. Settings Sheet
    const settingsRows = [
      { 'Setting': 'Event Name', 'Value': db.settings.event.name },
      { 'Setting': 'Tagline', 'Value': db.settings.event.tagline },
      { 'Setting': 'Round 1 Prep Time (s)', 'Value': db.settings.round1.prepTimeSeconds },
      { 'Setting': 'Round 1 Speech Time (s)', 'Value': db.settings.round1.speechTimeSeconds },
      { 'Setting': 'Round 2 Active Wheel Topics', 'Value': db.settings.round2.activeWheelTopicCount },
      { 'Setting': 'Round 2 Prep Time (s)', 'Value': db.settings.round2.prepTimeSeconds },
      { 'Setting': 'Round 2 Speech Time (s)', 'Value': db.settings.round2.speechTimeSeconds },
      { 'Setting': 'Round 3 Speech Time (s)', 'Value': db.settings.round3.speechTimeSeconds },
      { 'Setting': 'Buzzer Sound', 'Value': db.settings.buzzer.sound },
      { 'Setting': 'Buzzer Volume', 'Value': `${db.settings.buzzer.volume}%` },
    ];
    const wsSettings = XLSX.utils.json_to_sheet(settingsRows);
    XLSX.utils.book_append_sheet(wb, wsSettings, 'Settings');

    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Mind_to_Mic_Event_Report_${timestamp}.xlsx`);
  },
};
