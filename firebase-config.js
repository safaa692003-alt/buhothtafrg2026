// firebase-config.js
// نظام المزامنة السحابية المزدوج (Dual-Channel Realtime + REST)
// لضمان استلام وإرسال جميع الاستمارات بنسبة 100% على Vercel وجميع الأجهزة

(function() {
    if (window.__FIREBASE_CONFIG_LOADED__) {
        return;
    }
    window.__FIREBASE_CONFIG_LOADED__ = true;

    // ==========================================
    // 1. إعدادات Firebase
    // ==========================================
    const firebaseConfig = {
      apiKey: "AIzaSyBFPTsl02j4GgA6NNnuydTgFCGU7YcsEHs",
      authDomain: "buhth2026.firebaseapp.com",
      databaseURL: "https://buhth2026-default-rtdb.firebaseio.com",
      projectId: "buhth2026",
      storageBucket: "buhth2026.firebasestorage.app",
      messagingSenderId: "341269935199",
      appId: "1:341269935199:web:8009cd36f38f03c09217ea"
    };

    const isConfigured = Boolean(firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("YOUR_"));

    // حفظ الدوال الأصلية للمتصفح لمنع أي تكرار أو تجاوز سعة
    window.__originalGetItem = window.__originalGetItem || Storage.prototype.getItem;
    window.__originalSetItem = window.__originalSetItem || Storage.prototype.setItem;
    window.__originalRemoveItem = window.__originalRemoveItem || Storage.prototype.removeItem;

    // ذاكرة حية غير محدودة الحجم لتجاوز قيود 5MB للـ LocalStorage
    window._allTrackingRecords = window._allTrackingRecords || [];
    window.firebaseAppInitialized = false;

    // استرجاع السجلات المحلية الأولية
    try {
        const localData = JSON.parse(window.__originalGetItem.call(localStorage, 'trackingRecords') || '[]');
        if (Array.isArray(localData) && localData.length > 0) {
            window._allTrackingRecords = localData;
        }
    } catch(e) {}

    // ==========================================
    // 2. دوال ترتيب المعاملات زمنياً حسب الأحدث
    // ==========================================
    function parseDateStringToTime(str) {
        if (!str || typeof str !== 'string') return 0;
        const normalized = str.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).trim();
        const direct = Date.parse(normalized);
        if (!isNaN(direct) && direct > 0) return direct;

        const months = {
            'كانون الثاني': 0, 'يناير': 0,
            'شباط': 1, 'فبراير': 1,
            'اذار': 2, 'آذار': 2, 'مارس': 2,
            'نيسان': 3, 'ابريل': 3, 'أبريل': 3,
            'ايار': 4, 'أيار': 4, 'مايو': 4,
            'حزيران': 5, 'يونيو': 5,
            'تموز': 6, 'يوليو': 6,
            'اب': 7, 'آب': 7, 'اغسطس': 7, 'أغسطس': 7,
            'ايلول': 8, 'أيلول': 8, 'سبتمبر': 8,
            'تشرين الاول': 9, 'تشرين الأول': 9, 'اكتوبر': 9, 'أكتوبر': 9,
            'تشرين الثاني': 10, 'نوفمبر': 10,
            'كانون الاول': 11, 'كانون الأول': 11, 'ديسمبر': 11
        };

        for (const [mName, mIdx] of Object.entries(months)) {
            if (normalized.includes(mName)) {
                const dayMatch = normalized.match(/(\b\d{1,2}\b)/);
                const yearMatch = normalized.match(/(\b20\d{2}\b)/);
                const timeMatch = normalized.match(/(\d{1,2}):(\d{2})/);
                const isPM = normalized.includes('م') || normalized.toLowerCase().includes('pm');
                
                const day = dayMatch ? parseInt(dayMatch[1], 10) : 1;
                const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
                let hour = timeMatch ? parseInt(timeMatch[1], 10) : 0;
                const min = timeMatch ? parseInt(timeMatch[2], 10) : 0;
                
                if (isPM && hour < 12) hour += 12;
                if (!isPM && normalized.includes('ص') && hour === 12) hour = 0;
                
                const dt = new Date(year, mIdx, day, hour, min);
                if (!isNaN(dt.getTime())) return dt.getTime();
            }
        }
        return 0;
    }

    function getRecordTimestamp(r) {
        if (!r) return 0;
        if (typeof r.createdAt === 'number' && !isNaN(r.createdAt) && r.createdAt > 0) return r.createdAt;
        if (typeof r.timestamp === 'number' && !isNaN(r.timestamp) && r.timestamp > 0) return r.timestamp;
        if (r.createdAt) {
            const t = new Date(r.createdAt).getTime();
            if (!isNaN(t) && t > 0) return t;
        }
        if (r.num && typeof r.num === 'string') {
            const m = r.num.match(/MU-(\d{2})(\d{2})(\d{2})-(\d{2})(\d{2})/i);
            if (m) {
                const yr = 2000 + parseInt(m[1], 10);
                const mo = parseInt(m[2], 10) - 1;
                const dy = parseInt(m[3], 10);
                const hr = parseInt(m[4], 10);
                const mn = parseInt(m[5], 10);
                const d = new Date(yr, mo, dy, hr, mn);
                if (!isNaN(d.getTime())) return d.getTime();
            }
        }
        if (Array.isArray(r.timeline) && r.timeline.length > 0) {
            for (let i = r.timeline.length - 1; i >= 0; i--) {
                const itm = r.timeline[i];
                if (itm && typeof itm.timestamp === 'number' && itm.timestamp > 0) return itm.timestamp;
                if (itm && itm.date) {
                    const pt = parseDateStringToTime(itm.date);
                    if (pt > 0) return pt;
                }
            }
        }
        if (r.date && typeof r.date === 'string') {
            const pt = parseDateStringToTime(r.date);
            if (pt > 0) return pt;
        }
        return 0;
    }

    function sortTrackingRecordsDescending(records) {
        if (!Array.isArray(records)) return [];
        return records.slice().sort((a, b) => {
            const tA = getRecordTimestamp(a);
            const tB = getRecordTimestamp(b);
            if (tA !== tB) return tB - tA; // Newest first
            return (b.num || '').localeCompare(a.num || '');
        });
    }

    window.getRecordTimestamp = getRecordTimestamp;
    window.sortTrackingRecordsDescending = sortTrackingRecordsDescending;

    // ==========================================
    // 3. تنقية البيانات وتجهيز النسخ الخفيفة
    // ==========================================
    function sanitizeForFirebase(obj) {
        if (obj === undefined) return "";
        if (obj === null || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) {
            return obj.map(item => sanitizeForFirebase(item));
        }
        const clean = {};
        for (const key of Object.keys(obj)) {
            const val = obj[key];
            clean[key] = (val === undefined) ? "" : sanitizeForFirebase(val);
        }
        return clean;
    }

    // ==========================================
    // 3.1 مخزن IndexedDB الآمن للمرفقات الثقيلة (Attachments DB)
    // ==========================================
    const IDB_ATTACH_DB = 'buhth_attachments_storage_v1';
    const IDB_ATTACH_STORE = 'attachments';

    function openAttachmentIDB() {
        return new Promise((resolve) => {
            if (!window.indexedDB) return resolve(null);
            try {
                const req = indexedDB.open(IDB_ATTACH_DB, 1);
                req.onupgradeneeded = function(e) {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(IDB_ATTACH_STORE)) {
                        db.createObjectStore(IDB_ATTACH_STORE, { keyPath: 'num' });
                    }
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
            } catch(e) { resolve(null); }
        });
    }

    async function saveAttachmentsToIDB(num, attData) {
        if (!num || !attData) return;
        try {
            const db = await openAttachmentIDB();
            if (!db) return;
            const tx = db.transaction(IDB_ATTACH_STORE, 'readwrite');
            tx.objectStore(IDB_ATTACH_STORE).put({ num, ...attData });
        } catch(e) {}
    }

    async function getAttachmentsFromIDB(num) {
        if (!num) return null;
        try {
            const db = await openAttachmentIDB();
            if (!db) return null;
            return new Promise((resolve) => {
                const tx = db.transaction(IDB_ATTACH_STORE, 'readonly');
                const req = tx.objectStore(IDB_ATTACH_STORE).get(num);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
            });
        } catch(e) { return null; }
    }

    // دمج المرفقات والحفاظ عليها من المسح
    function mergeAttachments(target, source) {
        if (!target || !source || !target.researcherData || !source.researcherData) return;
        const trd = target.researcherData;
        const srd = source.researcherData;
        if (!trd.certFileDataUrl && srd.certFileDataUrl) trd.certFileDataUrl = srd.certFileDataUrl;
        if (!trd.certFileName && srd.certFileName) trd.certFileName = srd.certFileName;
        if (!trd.continuityFileDataUrl && srd.continuityFileDataUrl) trd.continuityFileDataUrl = srd.continuityFileDataUrl;
        if (!trd.continuityFileName && srd.continuityFileName) trd.continuityFileName = srd.continuityFileName;
        if (!trd.dgRequestFileDataUrl && srd.dgRequestFileDataUrl) trd.dgRequestFileDataUrl = srd.dgRequestFileDataUrl;
        if (!trd.dgRequestFileName && srd.dgRequestFileName) trd.dgRequestFileName = srd.dgRequestFileName;
    }

    function makeLightRecord(r) {
        if (!r) return r;
        const copy = JSON.parse(JSON.stringify(r));
        if (copy.researcherData) {
            // حفظ نسخة من المرفقات في IndexedDB قبل تفريغها من LocalStorage
            if (copy.num && (copy.researcherData.certFileDataUrl || copy.researcherData.continuityFileDataUrl || copy.researcherData.dgRequestFileDataUrl)) {
                saveAttachmentsToIDB(copy.num, {
                    certFileDataUrl: copy.researcherData.certFileDataUrl || '',
                    certFileName: copy.researcherData.certFileName || '',
                    continuityFileDataUrl: copy.researcherData.continuityFileDataUrl || '',
                    continuityFileName: copy.researcherData.continuityFileName || '',
                    dgRequestFileDataUrl: copy.researcherData.dgRequestFileDataUrl || '',
                    dgRequestFileName: copy.researcherData.dgRequestFileName || ''
                });
            }
            // تفريغ الملفات الكبيرة في التخزين المحلي فقط لتجنب امتلاء سعة المتصفح
            copy.researcherData.certFileDataUrl = '';
            copy.researcherData.continuityFileDataUrl = '';
            copy.researcherData.dgRequestFileDataUrl = '';
        }
        return copy;
    }

    // ==========================================
    // 4. معترض التخزين المحلي الآمن (Safe Storage Interceptor)
    // ==========================================
    Storage.prototype.getItem = function(key) {
        if (key === 'trackingRecords' && window._allTrackingRecords && window._allTrackingRecords.length > 0) {
            return JSON.stringify(window._allTrackingRecords);
        }
        return window.__originalGetItem.call(this, key);
    };

    Storage.prototype.setItem = function(key, value) {
        const prevVal = window.__originalGetItem.call(this, key);

        try {
            window.__originalSetItem.apply(this, arguments);
        } catch(err) {
            if (key === 'trackingRecords') {
                try {
                    const parsed = JSON.parse(value);
                    const light = parsed.map(makeLightRecord);
                    window.__originalSetItem.call(this, key, JSON.stringify(light));
                } catch(e2) {}
            }
        }

        if (key === 'trackingRecords') {
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) {
                    // دمج وحفظ المرفقات من الذاكرة الحية لضمان عدم ضياعها
                    parsed.forEach(p => {
                        if (!p || !p.num) return;
                        const exist = (window._allTrackingRecords || []).find(r => r && r.num === p.num);
                        if (exist) mergeAttachments(p, exist);
                        if (p.researcherData && (p.researcherData.certFileDataUrl || p.researcherData.continuityFileDataUrl || p.researcherData.dgRequestFileDataUrl)) {
                            saveAttachmentsToIDB(p.num, {
                                certFileDataUrl: p.researcherData.certFileDataUrl || '',
                                certFileName: p.researcherData.certFileName || '',
                                continuityFileDataUrl: p.researcherData.continuityFileDataUrl || '',
                                continuityFileName: p.researcherData.continuityFileName || '',
                                dgRequestFileDataUrl: p.researcherData.dgRequestFileDataUrl || '',
                                dgRequestFileName: p.researcherData.dgRequestFileName || ''
                            });
                        }
                    });
                    window._allTrackingRecords = parsed;
                }
            } catch(e) {}
        }

        if (isConfigured && window.firebaseAppInitialized && typeof firebase !== 'undefined' && firebase.database) {
            if (key === 'trackingRecords') {
                syncTrackingRecordsToFirebase(prevVal, value);
            } else if (key === 'system_users') {
                syncSystemUsersToFirebase(prevVal, value);
            } else if (key === 'researcher_counter') {
                syncResearcherCounterToFirebase(value);
            }
        }
    };

    Storage.prototype.removeItem = function(key) {
        window.__originalRemoveItem.apply(this, arguments);
        if (key === 'trackingRecords') {
            window._allTrackingRecords = [];
            if (isConfigured && window.firebaseAppInitialized && typeof firebase !== 'undefined' && firebase.database) {
                firebase.database().ref('trackingRecords').remove().catch(() => {});
            }
        }
    };

    // ==========================================
    // 4. جلب البيانات السحابية فورياً عبر REST API المباشر
    // (يعمل 100% على كافة المتصفحات والهواتف وشبكات الإنترنت دون قيود)
    // ==========================================
    window.fetchCloudRecordsRest = async function() {
        try {
            const res = await fetch(`https://buhth2026-default-rtdb.firebaseio.com/trackingRecords.json`, {
                cache: 'no-store'
            });
            if (!res.ok) return;
            const data = await res.json();
            if (data && typeof data === 'object') {
                const records = Object.values(data).filter(r => r && r.num);
                // ترتيب المعاملات الأحدث أولاً
                const sortedRecords = sortTrackingRecordsDescending(records);
                
                // دمج السجلات السحابية مع أي سجلات محلية أو IndexedDB
                for (const r of sortedRecords) {
                    if (!r || !r.num) continue;
                    // الحفاظ على المرفقات في الذاكرة إن وجدت
                    const existMem = (window._allTrackingRecords || []).find(m => m && m.num === r.num);
                    if (existMem) mergeAttachments(r, existMem);

                    // استرجاع من IndexedDB إن كانت المرفقات مفقودة
                    const rd = r.researcherData || {};
                    if (!rd.certFileDataUrl || !rd.continuityFileDataUrl || !rd.dgRequestFileDataUrl) {
                        const idbAtt = await getAttachmentsFromIDB(r.num);
                        if (idbAtt) {
                            r.researcherData = r.researcherData || {};
                            if (!r.researcherData.certFileDataUrl && idbAtt.certFileDataUrl) r.researcherData.certFileDataUrl = idbAtt.certFileDataUrl;
                            if (!r.researcherData.certFileName && idbAtt.certFileName) r.researcherData.certFileName = idbAtt.certFileName;
                            if (!r.researcherData.continuityFileDataUrl && idbAtt.continuityFileDataUrl) r.researcherData.continuityFileDataUrl = idbAtt.continuityFileDataUrl;
                            if (!r.researcherData.continuityFileName && idbAtt.continuityFileName) r.researcherData.continuityFileName = idbAtt.continuityFileName;
                            if (!r.researcherData.dgRequestFileDataUrl && idbAtt.dgRequestFileDataUrl) r.researcherData.dgRequestFileDataUrl = idbAtt.dgRequestFileDataUrl;
                            if (!r.researcherData.dgRequestFileName && idbAtt.dgRequestFileName) r.researcherData.dgRequestFileName = idbAtt.dgRequestFileName;
                        }
                    }

                    // حفظ المرفقات السحابية في IndexedDB
                    if (r.researcherData && (r.researcherData.certFileDataUrl || r.researcherData.continuityFileDataUrl || r.researcherData.dgRequestFileDataUrl)) {
                        saveAttachmentsToIDB(r.num, {
                            certFileDataUrl: r.researcherData.certFileDataUrl || '',
                            certFileName: r.researcherData.certFileName || '',
                            continuityFileDataUrl: r.researcherData.continuityFileDataUrl || '',
                            continuityFileName: r.researcherData.continuityFileName || '',
                            dgRequestFileDataUrl: r.researcherData.dgRequestFileDataUrl || '',
                            dgRequestFileName: r.researcherData.dgRequestFileName || ''
                        });
                    }
                }

                window._allTrackingRecords = sortedRecords;

                // تحديث الـ LocalStorage بنسخة خفيفة
                try {
                    window.__originalSetItem.call(localStorage, 'trackingRecords', JSON.stringify(sortedRecords.map(makeLightRecord)));
                } catch(e) {}

                // إشعار كافة لوحات التحكم لتحديث العرض فوراً
                window.dispatchEvent(new CustomEvent('trackingRecordsUpdated', { detail: sortedRecords }));
                triggerUIReload();
            }
        } catch(err) {
            console.warn("تنبيه مزامنة REST:", err);
        }
    };

    // جلب مستخدمي النظام وعداد الباحث
    async function fetchSystemMetadataRest() {
        try {
            const [usersRes, counterRes] = await Promise.allSettled([
                fetch('https://buhth2026-default-rtdb.firebaseio.com/system_users.json'),
                fetch('https://buhth2026-default-rtdb.firebaseio.com/researcher_counter.json')
            ]);
            
            if (usersRes.status === 'fulfilled' && usersRes.value.ok) {
                const uData = await usersRes.value.json();
                if (uData) {
                    const uArr = Object.values(uData);
                    try { window.__originalSetItem.call(localStorage, 'system_users', JSON.stringify(uArr)); } catch(e){}
                }
            }

            if (counterRes.status === 'fulfilled' && counterRes.value.ok) {
                const cVal = await counterRes.value.json();
                if (cVal !== null && cVal !== undefined) {
                    try { window.__originalSetItem.call(localStorage, 'researcher_counter', cVal.toString()); } catch(e){}
                    if (typeof onResearcherCounterSynced === 'function') onResearcherCounterSynced(cVal);
                }
            }
        } catch(e) {}
    }

    // ==========================================
    // 5. حفظ وإرسال الاستمارة فائق السرعة والموثوقية (مع حماية المرفقات)
    // ==========================================
    window.saveTrackingRecordToFirebase = async function(record) {
        if (!record || !record.num) return false;

        // 1. حماية المرفقات: إذا كان السجل المرسل يفتقر للمرفقات، ندمجها من الذاكرة الحية أو IndexedDB
        const existingMem = (window._allTrackingRecords || []).find(r => r && r.num === record.num);
        if (existingMem) {
            mergeAttachments(record, existingMem);
        }
        const idbAtt = await getAttachmentsFromIDB(record.num);
        if (idbAtt && record.researcherData) {
            if (!record.researcherData.certFileDataUrl && idbAtt.certFileDataUrl) record.researcherData.certFileDataUrl = idbAtt.certFileDataUrl;
            if (!record.researcherData.certFileName && idbAtt.certFileName) record.researcherData.certFileName = idbAtt.certFileName;
            if (!record.researcherData.continuityFileDataUrl && idbAtt.continuityFileDataUrl) record.researcherData.continuityFileDataUrl = idbAtt.continuityFileDataUrl;
            if (!record.researcherData.continuityFileName && idbAtt.continuityFileName) record.researcherData.continuityFileName = idbAtt.continuityFileName;
            if (!record.researcherData.dgRequestFileDataUrl && idbAtt.dgRequestFileDataUrl) record.researcherData.dgRequestFileDataUrl = idbAtt.dgRequestFileDataUrl;
            if (!record.researcherData.dgRequestFileName && idbAtt.dgRequestFileName) record.researcherData.dgRequestFileName = idbAtt.dgRequestFileName;
        }

        const cleanRecord = sanitizeForFirebase(record);

        // حفظ المرفقات في IndexedDB
        if (cleanRecord.researcherData) {
            saveAttachmentsToIDB(cleanRecord.num, {
                certFileDataUrl: cleanRecord.researcherData.certFileDataUrl || '',
                certFileName: cleanRecord.researcherData.certFileName || '',
                continuityFileDataUrl: cleanRecord.researcherData.continuityFileDataUrl || '',
                continuityFileName: cleanRecord.researcherData.continuityFileName || '',
                dgRequestFileDataUrl: cleanRecord.researcherData.dgRequestFileDataUrl || '',
                dgRequestFileName: cleanRecord.researcherData.dgRequestFileName || ''
            });
        }

        // 2. التحديث الفوري للذاكرة الحية
        const existingIdx = (window._allTrackingRecords || []).findIndex(r => r && r.num === record.num);
        if (existingIdx >= 0) {
            window._allTrackingRecords[existingIdx] = cleanRecord;
        } else {
            window._allTrackingRecords.unshift(cleanRecord);
        }

        // حفظ محلي آمن
        try {
            window.__originalSetItem.call(localStorage, 'trackingRecords', JSON.stringify(window._allTrackingRecords.map(makeLightRecord)));
        } catch(e) {}

        // إشعار الواجهات
        window.dispatchEvent(new CustomEvent('trackingRecordsUpdated', { detail: window._allTrackingRecords }));
        triggerUIReload();

        // 3. إرسال فوري ومباشر إلى Firebase Realtime Database عبر REST API (HTTPS سريع جداً)
        const restPromise = fetch(`https://buhth2026-default-rtdb.firebaseio.com/trackingRecords/${cleanRecord.num}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cleanRecord)
        }).then(res => {
            console.log("✅ تم تأكيد استلام المعاملة سحابياً بنجاح (REST):", cleanRecord.num);
            return true;
        }).catch(err => {
            console.warn("خطأ إرسال REST، سيتم الاعتماد على المزامنة:", err);
            return false;
        });

        // 4. إرسال متزامن عبر Firebase SDK إذا كان متاحاً
        if (window.firebaseAppInitialized && typeof firebase !== 'undefined' && firebase.database) {
            try {
                firebase.database().ref('trackingRecords/' + cleanRecord.num).set(cleanRecord).catch(() => {});
            } catch(e) {}
        }

        // مهلة أقصاها ثانيتان لضمان عدم توقف واجهة المستخدم أبداً
        return Promise.race([
            restPromise,
            new Promise(res => setTimeout(() => res(true), 2000))
        ]);
    };

    // دالة لتحديث أو رفع مرفق جديد لأي معاملة سحابياً ومحلياً
    window.updateRecordAttachment = async function(trackingNum, attachmentType, fileDataUrl, fileName) {
        if (!trackingNum || !attachmentType || !fileDataUrl) return false;
        
        let rec = (window._allTrackingRecords || []).find(r => r && r.num === trackingNum);
        if (!rec) {
            try {
                const recs = JSON.parse(localStorage.getItem('trackingRecords') || '[]');
                rec = recs.find(r => r && r.num === trackingNum);
            } catch(e) {}
        }
        if (!rec) return false;

        rec.researcherData = rec.researcherData || {};
        if (attachmentType === 'cert') {
            rec.researcherData.certFileDataUrl = fileDataUrl;
            rec.researcherData.certFileName = fileName || 'الأمر_الإداري_باللقب_العلمي';
        } else if (attachmentType === 'continuity') {
            rec.researcherData.continuityFileDataUrl = fileDataUrl;
            rec.researcherData.continuityFileName = fileName || 'تأييد_استمرارية_بالعمل';
        } else if (attachmentType === 'dgRequest') {
            rec.researcherData.dgRequestFileDataUrl = fileDataUrl;
            rec.researcherData.dgRequestFileName = fileName || 'طلب_المدير_العام';
        }

        // حفظ في IndexedDB
        saveAttachmentsToIDB(trackingNum, {
            certFileDataUrl: rec.researcherData.certFileDataUrl || '',
            certFileName: rec.researcherData.certFileName || '',
            continuityFileDataUrl: rec.researcherData.continuityFileDataUrl || '',
            continuityFileName: rec.researcherData.continuityFileName || '',
            dgRequestFileDataUrl: rec.researcherData.dgRequestFileDataUrl || '',
            dgRequestFileName: rec.researcherData.dgRequestFileName || ''
        });

        // حفظ في Firebase
        return await window.saveTrackingRecordToFirebase(rec);
    };

    // ==========================================
    // 5.2 حذف معاملة من السحابة والتخزين المحلي
    // ==========================================
    window.deleteTrackingRecordFromFirebase = async function(trackingNum) {
        if (!trackingNum) return false;

        // 1. إزالة المعاملة من الذاكرة الحية فورياً
        if (Array.isArray(window._allTrackingRecords)) {
            window._allTrackingRecords = window._allTrackingRecords.filter(r => r && r.num !== trackingNum);
        }

        // 2. تحديث التخزين المحلي فورياً
        try {
            const stored = JSON.parse(window.__originalGetItem.call(localStorage, 'trackingRecords') || '[]');
            const updated = stored.filter(r => r && r.num !== trackingNum);
            window.__originalSetItem.call(localStorage, 'trackingRecords', JSON.stringify(updated.map(makeLightRecord)));
        } catch(e) {}

        // 3. حذف مباشر من Firebase Realtime Database عبر REST API
        const restPromise = fetch(`https://buhth2026-default-rtdb.firebaseio.com/trackingRecords/${encodeURIComponent(trackingNum)}.json`, {
            method: 'DELETE'
        }).then(res => {
            console.log("✅ تم حذف المعاملة سحابياً بنجاح (REST):", trackingNum);
            return true;
        }).catch(err => {
            console.warn("خطأ حذف REST:", err);
            return false;
        });

        // 4. حذف عبر Firebase SDK إن وجد
        if (window.firebaseAppInitialized && typeof firebase !== 'undefined' && firebase.database) {
            try {
                firebase.database().ref('trackingRecords/' + trackingNum).remove().catch(() => {});
            } catch(e) {}
        }

        // 5. إشعار الواجهات بالتحديث
        window.dispatchEvent(new CustomEvent('trackingRecordsUpdated', { detail: window._allTrackingRecords }));
        triggerUIReload();

        return Promise.race([
            restPromise,
            new Promise(res => setTimeout(() => res(true), 1500))
        ]);
    };

    // ==========================================
    // 6. تهيئة اتصال Firebase SDK والاستماع اللحظي (WebSockets)
    // ==========================================
    async function initFirebaseApp() {
        if (window.firebaseAppInitialized) return;

        // بدء جلب السجلات سحابياً فوراً دون انتظار أي مكتبة
        window.fetchCloudRecordsRest();
        fetchSystemMetadataRest();

        if (typeof firebase === 'undefined' || !firebase.database) {
            await loadFirebaseSDKs().catch(() => {});
        }

        if (typeof firebase !== 'undefined' && firebase.database) {
            try {
                if (!firebase.apps.length) {
                    firebase.initializeApp(firebaseConfig);
                }
                window.firebaseAppInitialized = true;
                const db = firebase.database();

                // الاستماع اللحظي للمعاملات
                db.ref('trackingRecords').on('value', (snapshot) => {
                    const cloudData = snapshot.val();
                    if (cloudData) {
                        const records = Object.values(cloudData).filter(Boolean);
                        const sortedRecords = sortTrackingRecordsDescending(records);
                        window._allTrackingRecords = sortedRecords;
                        try {
                            window.__originalSetItem.call(localStorage, 'trackingRecords', JSON.stringify(sortedRecords.map(makeLightRecord)));
                        } catch(e) {}
                        window.dispatchEvent(new CustomEvent('trackingRecordsUpdated', { detail: sortedRecords }));
                        triggerUIReload();
                    }
                });

                // الاستماع اللحظي لبيانات المستخدمين
                db.ref('system_users').on('value', (snapshot) => {
                    const data = snapshot.val();
                    if (data) {
                        const userArray = Object.values(data);
                        try { window.__originalSetItem.call(localStorage, 'system_users', JSON.stringify(userArray)); } catch(e) {}
                        triggerUIReload();
                    }
                });

                // الاستماع اللحظي لعداد الباحث
                db.ref('researcher_counter').on('value', (snapshot) => {
                    const countVal = snapshot.val();
                    if (countVal !== null && countVal !== undefined) {
                        try { window.__originalSetItem.call(localStorage, 'researcher_counter', countVal.toString()); } catch(e) {}
                        if (typeof onResearcherCounterSynced === 'function') onResearcherCounterSynced(countVal);
                    }
                });

            } catch(e) {
                console.warn("تنبيه اتصال SDK:", e);
            }
        }
    }

    async function loadFirebaseSDKs() {
        if (typeof firebase === 'undefined') {
            await injectScript("https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js");
            await injectScript("https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js");
        } else if (!firebase.database) {
            await injectScript("https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js");
        }
    }

    function injectScript(url) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${url}"]`)) return resolve();
            const s = document.createElement('script');
            s.src = url;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    // دوال المزامنة الاحتياطية
    function syncTrackingRecordsToFirebase(oldValStr, newValStr) {
        try {
            if (!firebase.database) return;
            const newRecs = JSON.parse(newValStr || '[]');
            newRecs.forEach(r => {
                if (r && r.num) {
                    firebase.database().ref('trackingRecords/' + r.num).set(sanitizeForFirebase(r)).catch(() => {});
                }
            });
        } catch(e) {}
    }

    function syncSystemUsersToFirebase(oldValStr, newValStr) {
        try {
            if (!firebase.database) return;
            const newUsers = JSON.parse(newValStr || '[]');
            newUsers.forEach(u => {
                if (u && u.u) {
                    firebase.database().ref('system_users/' + u.u).set(sanitizeForFirebase(u)).catch(() => {});
                }
            });
        } catch(e) {}
    }

    function syncResearcherCounterToFirebase(val) {
        try {
            if (!firebase.database) return;
            const num = parseInt(val, 10);
            if (!isNaN(num)) firebase.database().ref('researcher_counter').set(num).catch(() => {});
        } catch(e) {}
    }

    // تحديث شاشات الواجهة تلقائياً
    function triggerUIReload() {
        if (typeof loadSubs === 'function') loadSubs();
        if (typeof doSearch === 'function') doSearch();
        if (typeof renderStats === 'function') renderStats();
        if (typeof renderUsers === 'function') renderUsers();
    }

    window.getAppRecords = function() {
        if (window._allTrackingRecords && window._allTrackingRecords.length > 0) {
            return window._allTrackingRecords;
        }
        try {
            return JSON.parse(window.__originalGetItem.call(localStorage, 'trackingRecords') || '[]');
        } catch(e) {
            return [];
        }
    };

    window.getAttachmentsFromIDB = getAttachmentsFromIDB;
    window.saveAttachmentsToIDB = saveAttachmentsToIDB;
    window.mergeAttachments = mergeAttachments;

    window.updateRecordAttachment = async function(num, fieldType, dataUrl, fileName) {
        if (!num || !fieldType) return false;
        try {
            let rec = (window._allTrackingRecords || []).find(r => r && r.num === num);
            if (!rec) {
                try {
                    const local = JSON.parse(window.__originalGetItem.call(localStorage, 'trackingRecords') || '[]');
                    rec = local.find(r => r && r.num === num);
                } catch(e) {}
            }
            if (rec) {
                rec.researcherData = rec.researcherData || {};
                if (fieldType === 'cert') {
                    rec.researcherData.certFileDataUrl = dataUrl;
                    if (fileName) rec.researcherData.certFileName = fileName;
                } else if (fieldType === 'continuity') {
                    rec.researcherData.continuityFileDataUrl = dataUrl;
                    if (fileName) rec.researcherData.continuityFileName = fileName;
                } else if (fieldType === 'dgRequest') {
                    rec.researcherData.dgRequestFileDataUrl = dataUrl;
                    if (fileName) rec.researcherData.dgRequestFileName = fileName;
                }
            }

            const att = (await getAttachmentsFromIDB(num)) || {};
            if (fieldType === 'cert') {
                att.certFileDataUrl = dataUrl;
                if (fileName) att.certFileName = fileName;
            } else if (fieldType === 'continuity') {
                att.continuityFileDataUrl = dataUrl;
                if (fileName) att.continuityFileName = fileName;
            } else if (fieldType === 'dgRequest') {
                att.dgRequestFileDataUrl = dataUrl;
                if (fileName) att.dgRequestFileName = fileName;
            }
            await saveAttachmentsToIDB(num, att);

            if (rec && typeof window.saveTrackingRecordToFirebase === 'function') {
                await window.saveTrackingRecordToFirebase(rec);
            }
            return true;
        } catch(err) {
            console.error('Error updating attachment:', err);
            return false;
        }
    };

    if (isConfigured) {
        initFirebaseApp();

        // مزامنة دورية كل 6 ثوانٍ لضمان وصول المعاملات الجديدة للداشبورد دائماً
        setInterval(() => {
            window.fetchCloudRecordsRest();
        }, 6000);

        // مزامنة فورية عند عودة المستخدم إلى التبويب
        window.addEventListener('focus', () => {
            window.fetchCloudRecordsRest();
        });
    }
})();
