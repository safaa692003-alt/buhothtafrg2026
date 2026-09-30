import io

with io.open('F:/البحوث كوين/buhth2026/dashboard.html', 'r', encoding='utf-8') as f:
    content = f.read()

target = """            <label for="sig-upload" style="cursor:pointer; background:#eee; padding:5px 10px; border-radius:4px; font-size:14px; display:inline-block; border:1px solid #ccc; color:#333;">📁 أو رفع صورة توقيع (PNG)</label>
            <input type="file" id="sig-upload" accept="image/png" style="display:none;" onchange="handleSigUpload(event)">
            loadSubs();
        }
    });"""

replacement = """            <label for="sig-upload" style="cursor:pointer; background:#eee; padding:5px 10px; border-radius:4px; font-size:14px; display:inline-block; border:1px solid #ccc; color:#333;">📁 أو رفع صورة توقيع (PNG)</label>
            <input type="file" id="sig-upload" accept="image/png" style="display:none;" onchange="handleSigUpload(event)">
        </div>
        </div>
        <!-- Upload Mode -->
        <div id="sig-upload-mode" style="display:none;">
            <div class="sig-upload-area" id="sig-upload-area">
                <div class="upload-icon">🖼️</div>
                <div class="upload-text">اسحب صورة التوقيع هنا أو انقر للاختيار</div>
                <div class="upload-hint">يدعم صور PNG فقط — خلفية شفافة مفضّلة</div>
                <input type="file" id="sig-file-input" accept=".png,image/png" onchange="handleSigFileSelect(event)">
            </div>
            <div class="sig-upload-preview" id="sig-upload-preview">
                <img id="sig-upload-img" src="" alt="معاينة التوقيع">
                <br>
                <button class="remove-upload" onclick="removeSigUpload()">🗑️ إزالة الصورة</button>
            </div>
        </div>
        <div class="sig-modal-btns">
            <button class="sig-save-btn" onclick="saveDashboardSig()">✅ حفظ التوقيع</button>
            <button class="sig-clear-btn" id="sig-clear-draw-btn" onclick="clearDashboardCanvas()">🗑️ مسح</button>
            <button class="sig-cancel-btn" onclick="closeDashboardSigModal()">❌ إلغاء</button>
        </div>
    </div>
</div>

<div class="toast" id="toast"></div>

<script src="print_helper.js"></script>
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
    const SESSION_KEY = 'auth_research_dept';

    /* === فحص الجلسة عند تحميل الصفحة === */
    window.addEventListener('load', () => {
        if(sessionStorage.getItem(SESSION_KEY) === '1') {
            document.getElementById('login-page').style.display = 'none';
            document.getElementById('dashboard').style.display = 'flex';
            loadSubs();
        }
    });"""

if target in content:
    content = content.replace(target, replacement)
    with io.open('F:/البحوث كوين/buhth2026/dashboard.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS")
else:
    print("TARGET NOT FOUND")
