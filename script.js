import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, updateDoc, onSnapshot, query, where, orderBy, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDt9JjXA9exvu4bYInUKX2ZpdOOrNYo0UQ", 
  authDomain: "gerenciamento-escolar-a6e87.firebaseapp.com",
  projectId: "gerenciamento-escolar-a6e87",
  storageBucket: "gerenciamento-escolar-a6e87.firebasestorage.app",
  messagingSenderId: "163298632936",
  appId: "1:163298632936:web:001cc036a94d408c7a555d",
  measurementId: "G-G7JG8S361S"
};

// Inicialização
const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);
const storage = getStorage(fbApp);
const provider = new GoogleAuthProvider();

let currentUser = null;
let currentSubjectId = null;
let activeInst = 'medio';
let studentsList = [];

const btnLogin = document.getElementById('btnLogin');
if(btnLogin) {
    btnLogin.onclick = () => {
        signInWithPopup(auth, provider).catch(err => {
            console.error("Erro Login:", err);
            const msg = document.getElementById('login-msg');
            
            if(err.code === 'auth/unauthorized-domain') {
                msg.innerText = "ERRO: O domínio 127.0.0.1 não está autorizado no Firebase Authentication.";
                alert("Vá no Firebase Console > Authentication > Configurações > Domínios Autorizados e adicione: 127.0.0.1");
            } else if (err.code === 'auth/api-key-not-valid') {
                msg.innerText = "ERRO: A Chave API (apiKey) no script.js está incorreta.";
                alert("Verifique a apiKey no seu código. Pode haver espaços extras.");
            } else {
                msg.innerText = "Erro: " + err.message;
            }
        });
    };
}

const btnLogout = document.getElementById('btnLogout');
if(btnLogout) btnLogout.onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        document.getElementById('userName').innerText = user.displayName;
        document.getElementById('userImg').src = user.photoURL;
        loadSubjects();
        
        const theme = localStorage.getItem('theme') || 'light';
        document.body.setAttribute('data-theme', theme);
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
    }
});

window.app = {
    toggleTheme: () => {
        const cur = document.body.getAttribute('data-theme');
        const next = cur === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
    },

    saveData: () => {
        const btn = document.querySelector('.top-controls .btn-primary');
        if(btn) {
            const original = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> Salvo!';
            setTimeout(() => btn.innerHTML = original, 1500);
        }
    },

    setInstitution: (inst) => {
        activeInst = inst;
        document.querySelectorAll('.inst-tab').forEach(b => b.classList.remove('active'));
        if(event && event.currentTarget) event.currentTarget.classList.add('active');
        
        document.getElementById('empty-view').style.display = 'block';
        document.getElementById('subject-view').style.display = 'none';
        document.getElementById('schedule-view').style.display = 'none';
        loadSubjects();
    },

    showSchedule: () => {
        document.getElementById('empty-view').style.display = 'none';
        document.getElementById('subject-view').style.display = 'none';
        document.getElementById('schedule-view').style.display = 'block';
        loadSchedule();
    },

    addScheduleItem: async () => {
        const day = document.getElementById('schDay').value;
        const text = document.getElementById('schText').value;
        if(!text) return;
        
        try {
            await addDoc(collection(db, "horarios"), { 
                uid: currentUser.uid, 
                institution: activeInst, 
                day: day, 
                text: text, 
                createdAt: new Date() 
            });
            document.getElementById('schText').value = '';
        } catch (e) {
            alert("Erro ao salvar horário: " + e.message);
        }
    },

    deleteScheduleItem: async (id) => {
        if(confirm("Remover este horário?")) {
            await deleteDoc(doc(db, "horarios", id));
        }
    },

    openModal: () => { 
        document.getElementById('modal-subject').style.display = 'flex'; 
        document.getElementById('modalSubName').focus(); 
        
        const btn = document.querySelector('.modal-actions .btn-primary');
        if(btn) {
            btn.disabled = false;
            btn.innerText = "Criar";
        }
    },
    
    closeModal: () => { 
        document.getElementById('modal-subject').style.display = 'none'; 
        document.getElementById('modalSubName').value = ''; 
    },

    createSubject: async () => {
        const nameInput = document.getElementById('modalSubName');
        const name = nameInput.value;
        const btn = document.querySelector('.modal-actions .btn-primary');

        if(!name) return;
        if(!currentUser) return alert("Erro: Você precisa estar logado!");

        btn.disabled = true;
        btn.innerText = "Criando...";

        try {
            await addDoc(collection(db, "disciplinas"), {
                name: name,
                institution: activeInst,
                teacherId: currentUser.uid,
                createdAt: new Date()
            });

            app.closeModal();

        } catch (e) {
            console.error(e);
            if(e.code === 'permission-denied') {
                alert("Erro de Permissão: Verifique as Regras do Firestore no Console.");
            } else {
                alert("Erro ao criar: " + e.message);
            }
        } finally {
            btn.disabled = false;
            btn.innerText = "Criar";
        }
    },

    deleteSubject: async () => {
        if(confirm("Tem certeza? Isso apagará a matéria permanentemente.")) {
            try {
                await deleteDoc(doc(db, "disciplinas", currentSubjectId));
                document.getElementById('subject-view').style.display = 'none';
                document.getElementById('empty-view').style.display = 'block';
                alert("Matéria excluída!");
            } catch(e) { 
                alert("Erro ao excluir: " + e.message); 
            }
        }
    },

    selectSubject: (id, name) => {
        currentSubjectId = id;
        document.getElementById('page-title').innerText = name;
        document.getElementById('empty-view').style.display = 'none';
        document.getElementById('schedule-view').style.display = 'none';
        document.getElementById('subject-view').style.display = 'block';
        
        document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
        const menuEl = document.getElementById(`menu-${id}`);
        if(menuEl) menuEl.classList.add('active');

        app.switchTab('alunos'); 
    },

    switchTab: (tab) => {
        document.querySelectorAll('.tab-pane').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        document.getElementById('tab-'+tab).style.display = 'block';
        if(event && event.currentTarget) event.currentTarget.classList.add('active');

        if(tab === 'alunos') loadStudents();
        if(tab === 'chamada') loadAttendanceUI();
        if(tab === 'notas') loadGradesUI();
        if(tab === 'trabalhos') loadTasks();
        if(tab === 'planning') loadPlanHistory();
    },

    printPlans: () => window.print(),

    addStudent: async () => {
        const name = document.getElementById('newStudentName').value;
        if(!name) return;
        try {
            await addDoc(collection(db, "alunos"), { subjectId: currentSubjectId, name: name, grades: {} });
            document.getElementById('newStudentName').value = '';
        } catch(e) { alert(e.message); }
    },

    importStudentsTxt: async () => {
        const fileInput = document.getElementById('importFile');
        const file = fileInput.files[0];
        if(!file) return alert("Selecione um arquivo .txt");

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target.result;
            const names = text.split('\n').map(n => n.trim()).filter(n => n.length > 0);
            if(names.length === 0) return alert("Arquivo vazio.");

            if(confirm(`Importar ${names.length} alunos?`)) {
                let count = 0;
                for (let name of names) {
                    await addDoc(collection(db, "alunos"), { subjectId: currentSubjectId, name: name, grades: {} });
                    count++;
                }
                alert(`${count} alunos importados!`);
                fileInput.value = '';
            }
        };
        reader.readAsText(file);
    },

    saveAttendance: async () => {
        const date = document.getElementById('attDate').value;
        if(!date) return alert("Selecione a data!");
        
        const presentIds = [];
        studentsList.forEach(s => { 
            const chk = document.getElementById(`chk_${s.id}`);
            if(chk && chk.checked) presentIds.push(s.id); 
        });
        
        try {
            await addDoc(collection(db, "frequencia"), { subjectId: currentSubjectId, date: date, presentIds: presentIds, total: studentsList.length });
            alert("Chamada Salva!");
        } catch(e) { alert("Erro ao salvar chamada: " + e.message); }
    },

    // --- NOTAS ---
    saveGrade: async (id, f, v) => {
        const ref = doc(db, "alunos", id);
        const update = {}; update[`grades.${f}`] = v;
        try {
            await updateDoc(ref, update);
            loadGradesUI();
        } catch(e) { console.error("Erro ao salvar nota", e); }
    },

    // --- RELATÓRIOS ---
    genReport: async () => {
        const out = document.getElementById('report-output');
        out.innerHTML = "Calculando...";
        
        const type = document.getElementById('rType').value;
        if(type === 'freq') {
            const q = query(collection(db, "frequencia"), where("subjectId", "==", currentSubjectId));
            const snaps = await getDocs(q);
            let total = snaps.size;
            
            if(total === 0) {
                out.innerHTML = "Sem dados de frequência para esta matéria.";
                return;
            }
            
            let map = {};
            snaps.forEach(doc => { doc.data().presentIds.forEach(id => map[id] = (map[id]||0)+1); });
            
            let h = `<table style="width:100%"><thead><tr><th>Aluno</th><th>% Presença</th></tr></thead><tbody>`;
            studentsList.forEach(s => {
                let p = map[s.id] || 0;
                let perc = ((p/total)*100).toFixed(0);
                let color = perc < 75 ? 'red' : 'green';
                h += `<tr><td>${s.name}</td><td style="color:${color};font-weight:bold">${perc}%</td></tr>`;
            });
            h += `</tbody></table>`;
            out.innerHTML = h;
        }
    }
};

let unsubSchedule = null;
function loadSchedule() {
    if(unsubSchedule) unsubSchedule();
    const q = query(collection(db, "horarios"), where("uid", "==", currentUser.uid), where("institution", "==", activeInst), orderBy("createdAt"));
    unsubSchedule = onSnapshot(q, (snaps) => {
        const tbody = document.getElementById('schedule-body');
        if(tbody) {
            tbody.innerHTML = "";
            snaps.forEach(doc => {
                const d = doc.data();
                tbody.innerHTML += `<tr><td>${d.day}</td><td>${d.text}</td><td><button class="btn-outline" onclick="app.deleteScheduleItem('${doc.id}')">X</button></td></tr>`;
            });
        }
    });
}

const btnSavePlan = document.getElementById('btnSavePlan');
if(btnSavePlan) {
    btnSavePlan.onclick = async () => {
        const date = document.getElementById('planDate').value;
        if(!date) return alert("Selecione a data");
        
        btnSavePlan.innerText = "Salvando..."; 
        btnSavePlan.disabled = true;
        
        const planData = {
            subjectId: currentSubjectId, date: date,
            qty: document.getElementById('planQty').value,
            content: document.getElementById('planContent').value,
            obj: document.getElementById('planObj').value,
            met: document.getElementById('planMet').value,
            rec: document.getElementById('planRec').value,
            bib: document.getElementById('planBib').value,
            eval: document.getElementById('planEval').value,
            createdAt: new Date()
        };
        
        try { 
            await addDoc(collection(db, "planos_aula"), planData); 
            app.saveData(); 
            document.getElementById('planContent').value='';
            document.getElementById('planObj').value='';
        } catch(e) { 
            alert(e.message); 
        } finally { 
            btnSavePlan.innerText = "Salvar Plano"; 
            btnSavePlan.disabled = false; 
        }
    };
}

let unsubPlans = null;
function loadPlanHistory() {
    if(unsubPlans) unsubPlans();
    const q = query(collection(db, "planos_aula"), where("subjectId", "==", currentSubjectId), orderBy("date", "desc"));
    unsubPlans = onSnapshot(q, (snaps) => {
        const list = document.getElementById('plan-list-items');
        if(list) {
            list.innerHTML = "";
            snaps.forEach(doc => {
                const p = doc.data();
                const resumo = p.content ? p.content.substring(0,30) : "Sem conteúdo";
                list.innerHTML += `<div class="plan-item"><strong>${p.date.split('-').reverse().join('/')}</strong><span>${resumo}...</span></div>`;
            });
        }
    });
}

let unsubSubjects = null;
function loadSubjects() {
    if(!currentUser) return;
    if(unsubSubjects) unsubSubjects();
    
    const q = query(collection(db, "disciplinas"), where("teacherId", "==", currentUser.uid), where("institution", "==", activeInst));
    
    unsubSubjects = onSnapshot(q, (snaps) => {
        const list = document.getElementById('subject-list');
        if(list) {
            list.innerHTML = "";
            if(snaps.empty) list.innerHTML = `<p style="text-align:center;font-size:0.8rem;color:#888;margin-top:20px;">Nenhuma matéria.</p>`;
            
            snaps.forEach(doc => {
                const d = doc.data();
                list.innerHTML += `<div id="menu-${doc.id}" class="menu-item" onclick="app.selectSubject('${doc.id}', '${d.name}')"><i class="fas fa-book"></i> ${d.name}</div>`;
            });
        }
    });
}

let unsubStudents = null;
function loadStudents() {
    if(unsubStudents) unsubStudents();
    const q = query(collection(db, "alunos"), where("subjectId", "==", currentSubjectId), orderBy("name"));
    unsubStudents = onSnapshot(q, (snaps) => {
        const tbody = document.querySelector('#table-students tbody');
        if(tbody) {
            tbody.innerHTML = "";
            studentsList = [];
            snaps.forEach(doc => {
                const s = { id: doc.id, ...doc.data() };
                studentsList.push(s);
                tbody.innerHTML += `<tr><td>${s.name}</td><td><button class="btn-outline" onclick="deleteStudent('${s.id}')">X</button></td></tr>`;
            });
            const countEl = document.getElementById('student-count');
            if(countEl) countEl.innerText = studentsList.length;
        }
    });
}

// Função global para deletar via HTML string
window.deleteStudent = async (id) => {
    if(confirm("Remover aluno?")) {
        await deleteDoc(doc(db, "alunos", id));
    }
}

function loadAttendanceUI() {
    const tbody = document.querySelector('#table-attendance tbody');
    if(tbody) {
        tbody.innerHTML = studentsList.map(s => `<tr><td>${s.name}</td><td style="text-align:center"><input type="checkbox" id="chk_${s.id}" checked style="width:20px;height:20px;"></td></tr>`).join('');
        const dateInput = document.getElementById('attDate');
        if(dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    }
}

function loadGradesUI() {
    const thead = document.getElementById('grades-header');
    const tbody = document.getElementById('grades-body');
    if(thead && tbody) {
        let h = activeInst === 'medio' ? `<tr><th>Aluno</th><th>1º Bim</th><th>2º Bim</th><th>3º Bim</th><th>4º Bim</th><th>Média</th></tr>` : `<tr><th>Aluno</th><th>N1</th><th>N2</th><th>Média</th></tr>`;
        thead.innerHTML = h;
        tbody.innerHTML = studentsList.map(s => {
            const g = s.grades || {};
            let inputs = '', avg = 0;
            if(activeInst === 'medio') {
                avg = ((Number(g.b1||0)+Number(g.b2||0)+Number(g.b3||0)+Number(g.b4||0))/4).toFixed(1);
                inputs = `<td><input class="grade-input" type="number" value="${g.b1||''}" onblur="app.saveGrade('${s.id}','b1',this.value)"></td>
                          <td><input class="grade-input" type="number" value="${g.b2||''}" onblur="app.saveGrade('${s.id}','b2',this.value)"></td>
                          <td><input class="grade-input" type="number" value="${g.b3||''}" onblur="app.saveGrade('${s.id}','b3',this.value)"></td>
                          <td><input class="grade-input" type="number" value="${g.b4||''}" onblur="app.saveGrade('${s.id}','b4',this.value)"></td>`;
            } else {
                avg = ((Number(g.n1||0)+Number(g.n2||0))/2).toFixed(1);
                inputs = `<td><input class="grade-input" type="number" value="${g.n1||''}" onblur="app.saveGrade('${s.id}','n1',this.value)"></td>
                          <td><input class="grade-input" type="number" value="${g.n2||''}" onblur="app.saveGrade('${s.id}','n2',this.value)"></td>`;
            }
            return `<tr><td>${s.name}</td>${inputs}<td style="font-weight:bold">${avg}</td></tr>`;
        }).join('');
    }
}

let unsubTasks = null;
function loadTasks() {
    if(unsubTasks) unsubTasks();
    const q = query(collection(db, "tarefas"), where("subjectId", "==", currentSubjectId), orderBy("createdAt", "desc"));
    unsubTasks = onSnapshot(q, (snaps) => {
        const list = document.getElementById('tasks-list');
        if(list) {
            list.innerHTML = "";
            snaps.forEach(doc => {
                const t = doc.data();
                list.innerHTML += `<div class="card"><h4>${t.titulo} (${t.data})</h4><p>Envio de arquivo disponível.</p></div>`;
            });
        }
    });
}
const btnSaveTask1 = document.getElementById('btnSaveTask');
if(btnSaveTask1) {
    btnSaveTask1.onclick = async () => {
        const title = document.getElementById('taskTitle').value;
        const date = document.getElementById('taskDate').value;
        if(!title) return;
        try {
            await addDoc(collection(db, "tarefas"), { subjectId: currentSubjectId, titulo: title, data: date, createdAt: new Date() });
            app.saveData(); 
            document.getElementById('taskTitle').value='';
        } catch(e) { alert(e.message); }
    };
}