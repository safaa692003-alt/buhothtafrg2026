const fs = require('fs');

let content = fs.readFileSync('director_dashboard.html', 'utf8');

const brokenRegex = /<button class="btn"[^>]*>📊 تحميل كملف Excel<\/button>\s*const sigs = currentRec\?.signatures \|\| \{\};/;

const fixedPart = `<button class="btn" style="background:linear-gradient(135deg,#00b894,#00cec9); color:#fff; padding:6px 14px; font-size:13px; border:none; border-radius:6px; cursor:pointer; font-family:Arial,sans-serif; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.1);" onclick="exportResearcherExcel()">📊 تحميل كملف Excel</button>
</div>
            <div class="ig" id="res-info"></div>

            <div class="stit" id="attachment-title" style="display:none">📎 المرفقات (الأمر الإداري باللقب العلمي)</div>
            <div id="attachment-container" style="display:none; background:#f4f6f9; border:1px solid #ddd; padding:15px; border-radius:6px; margin-bottom:15px; text-align:center;">
                <div id="attachment-preview" style="margin-bottom:10px; font-weight:bold; color:#111111;"></div>
                <div id="attachment-actions">
                     <a id="attachment-download-btn" class="btn" style="background:#007bff; color:white; padding:8px 16px; text-decoration:none; border-radius:4px; font-weight:bold; display:inline-block; cursor:pointer;" download>📂 تحميل المرفق</a>
                </div>
            </div>

            <div class="stit" id="continuity-title" style="display:none">📎 المرفقات (تأييد استمرارية بالعمل)</div>
            <div id="continuity-container" style="display:none; background:#f4f6f9; border:1px solid #ddd; padding:15px; border-radius:6px; margin-bottom:15px; text-align:center;">
                <div id="continuity-preview" style="margin-bottom:10px; font-weight:bold; color:#111111;"></div>
                <div id="continuity-actions">
                     <a id="continuity-download-btn" class="btn" style="background:#007bff; color:white; padding:8px 16px; text-decoration:none; border-radius:4px; font-weight:bold; display:inline-block; cursor:pointer;" download>📂 تحميل المرفق</a>
                </div>
            </div>

            <!-- PDF PREVIEW OF TAFRAGH FORM WITH ACTIVE SIGNATURE SLOTS -->
            <div class="stit">📄 ملف استمارة التفرغ العلمي (انقر على خانة التوقيع للتوقيع)</div>
            <div class="form-pdf-preview" id="pdf-preview-container"></div>

            <div class="stit">🔄 خط سير المعاملة</div>
            <div class="tl" id="tl-wrap"></div>

            <div class="abtn-fwd-container">
                <button class="abtn abtn-fwd" id="fwd-btn" disabled onclick="approveAndReturn()">
                    ✅ اعتماد المعاملة وإرسالها للطباعة ◄
                </button>
            </div>
        </div>
    </div>
</div>

<!-- ===== REUSABLE SIGNATURE MODAL ===== -->
<div class="sig-modal-overlay" id="sig-modal-overlay">
    <div class="sig-modal">
        <h3 id="sig-modal-title">✒️ إضافة التوقيع الرسمي للمدير العام</h3>
        <div class="sig-canvas-wrap">
            <canvas id="sig-canvas" width="460" height="150"></canvas>
        </div>
        <div style="margin-top:10px; text-align:center;">
            <label for="sig-upload" style="cursor:pointer; background:#eee; padding:5px 10px; border-radius:4px; font-size:14px; display:inline-block; border:1px solid #ccc; color:#333;">📁 أو رفع صورة توقيع (PNG)</label>
            <input type="file" id="sig-upload" accept="image/png" style="display:none;" onchange="handleSigUpload(event)">
        </div>
        <div class="sig-modal-btns">
            <button class="sig-save-btn" onclick="saveDashboardSig()">✅ حفظ التوقيع</button>
            <button class="sig-clear-btn" onclick="clearDashboardCanvas()">🗑️ مسح</button>
            <button class="sig-cancel-btn" onclick="closeDashboardSigModal()">❌ إلغاء</button>
        </div>
    </div>
</div>

<div class="toast" id="toast"></div>

<script src="firebase-config.js"></script>
<script>
    function checkLogin(u, p, role) {
        try {
            const defaults = [
                {"u":"admin_research","p":"123","role":"research"},
                {"u":"admin_hr","p":"456","role":"hr"},
                {"u":"admin_director","p":"789","role":"director"},
                {"u":"admin","p":"999","role":"stats"}
            ];
            const users = JSON.parse(localStorage.getItem('system_users') || JSON.stringify(defaults));
            return users.some(usr => usr.u === u && usr.p === p && usr.role === role);
        } catch(e) {
            return false;
        }
    }
    const SESSION_KEY='auth_director';
    let currentRec=null;
    let activeSigSlot = null;
    let drawing=false, lx=0, ly=0;

    /* === فحص الجلسة عند تحميل الصفحة === */
    window.addEventListener('load',()=>{
        if(sessionStorage.getItem(SESSION_KEY)==='1'){
            document.getElementById('login-page').style.display='none';
            document.getElementById('dashboard').style.display='flex';
            loadSubs();
        }
    });

    /* ===== Signature Pad Logic ===== */
    const canvas = document.getElementById('sig-canvas');
    const ctx = canvas.getContext('2d');

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        if (e.touches) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top) * scaleY
            };
        }
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    canvas.addEventListener('mousedown', e => { drawing = true; const p=getPos(e); lx=p.x; ly=p.y; });
    canvas.addEventListener('mousemove', e => {
        if (!drawing) return;
        const p = getPos(e);
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = '#000000'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
        lx = p.x; ly = p.y;
    });
    canvas.addEventListener('mouseup', () => drawing = false);
    canvas.addEventListener('mouseleave', () => drawing = false);
    canvas.addEventListener('touchstart', e => { e.preventDefault(); drawing=true; const p=getPos(e); lx=p.x; ly=p.y; }, {passive:false});
    canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        if (!drawing) return;
        const p = getPos(e);
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = '#000000'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
        lx = p.x; ly = p.y;
    }, {passive:false});
    canvas.addEventListener('touchend', () => drawing=false);

    function openDashboardSigModal(slotId) {
        activeSigSlot = slotId;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        document.getElementById('sig-modal-overlay').style.display = 'flex';
    }

    function closeDashboardSigModal() {
        document.getElementById('sig-modal-overlay').style.display = 'none';
        activeSigSlot = null;
    }

    function clearDashboardCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const fileInput = document.getElementById('sig-upload');
        if (fileInput) fileInput.value = '';
    }

    function handleSigUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
                const w = img.width * scale;
                const h = img.height * scale;
                const x = (canvas.width - w) / 2;
                const y = (canvas.height - h) / 2;
                ctx.drawImage(img, x, y, w, h);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    function saveDashboardSig() {
        const blank = document.createElement('canvas');
        blank.width = canvas.width; blank.height = canvas.height;
        if (canvas.toDataURL() === blank.toDataURL()) {
            alert('يرجى كتابة التوقيع أولاً أو رفع صورة!'); return;
        }
        const dataUrl = canvas.toDataURL('image/png');

        if (!currentRec) return;
        currentRec.signatures = currentRec.signatures || {};

        if (activeSigSlot === 'sig-dir-2') {
            currentRec.signatures.director = dataUrl;
        }

        // Save immediately in localStorage
        let recs = getRecs();
        const idx = recs.findIndex(r => r.num === currentRec.num);
        if (idx !== -1) {
            recs[idx].signatures = currentRec.signatures;
            localStorage.setItem('trackingRecords', JSON.stringify(recs));
        }

        generateFormPreview(currentRec);
        checkRequiredSignatures();
        closeDashboardSigModal();
    }

    function checkRequiredSignatures() {
        const sigs = currentRec?.signatures || {};`;

content = content.replace(brokenRegex, fixedPart);
fs.writeFileSync('director_dashboard.html', content, 'utf8');
console.log("director_dashboard fixed.");
