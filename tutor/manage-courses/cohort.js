import { supabase } from '../../src/supabase.js';
import { getThumbnailUrl } from '../../src/utils.js';


export async function renderCohortView(containerId) {
    const { data: { session } } = await supabase.auth.getSession();
    const currentTutorId = session?.user?.id;

    const container = document.getElementById(containerId);
    container.innerHTML = `
        <div class="flex items-center gap-4 mb-6">
            <button onclick="window.manageCoursesState.showView('main')" class="p-2 hover:bg-gray-100 rounded-full transition text-gray-500">
                <i data-lucide="arrow-left" class="w-5 h-5"></i>
            </button>
            <div>
                <h2 class="text-2xl font-bold flex items-center justify-between">
                    Cohort Courses
                </h2>
                <p class="text-gray-500 text-sm">Live group courses with scheduled sessions</p>
            </div>
            <button onclick="window.cohortState.openCreateModal()" class="ml-auto bg-green-700 text-white font-medium px-4 py-2 text-sm rounded shadow-sm hover:bg-green-800 transition flex items-center gap-2 pl-8 relative">
                <i data-lucide="plus" class="w-4 h-4 absolute left-3"></i>
                Create New Cohort
            </button>
        </div>

        <div class="flex gap-2 mb-6 border-b border-gray-100">
            <button class="px-5 py-2.5 bg-gray-50/70 border border-gray-200 border-b-0 text-sm font-medium rounded-t-xl text-gray-800 shadow-sm relative top-[1px]">Your Live Cohorts</button>
        </div>

        <div class="bg-white border text-center border-gray-200 rounded-xl p-8 mb-8 min-h-[250px] flex flex-col">
            <div id="cohort-courses-list" class="flex-1">
                <div class="flex items-center justify-center h-48 text-gray-400">Loading cohorts...</div>
            </div>
        </div>
        
        <div id="cohort-modal-container"></div>
    `;

    lucide.createIcons();

    window.cohortState = {
        step: 1,
        formData: {
            title: '',
            description: '',
            thumbnail_url: '',
            price: 0,
            cohort_days: [],
            start_time: '',
            end_time: '',
            modules: [] // { title, live_link, video_url, materials_url }
        },
        openCreateModal: function() {
            if (!window.verifyPayoutDetails()) return;
            this.step = 1;
            this.formData = { title: '', description: '', thumbnail_url: '', price: 0, cohort_days: [], start_time: '', end_time: '', modules: [] };
            this.renderModal();
        },
        closeModal: function() {
            document.getElementById('cohort-modal-container').innerHTML = '';
        },
        toggleDay: function(day) {
            const idx = this.formData.cohort_days.indexOf(day);
            if (idx > -1) this.formData.cohort_days.splice(idx, 1);
            else this.formData.cohort_days.push(day);
            this.renderModal();
        },
        nextStep: function() {
            this.captureData();
            if (this.step === 1) {
                if (!this.formData.title || !this.formData.thumbnail_url) return alert('Title and Thumbnail are mandatory!');
            }
            if (this.step === 2) {
                if (this.formData.cohort_days.length === 0) return alert('Select at least one day!');
                if (!this.formData.start_time || !this.formData.end_time) return alert('Timings are mandatory!');
            }
            if (this.step < 4) {
                this.step++;
                this.renderModal();
            } else {
                this.createCohort();
            }
        },
        prevStep: function() {
            this.captureData();
            if (this.step > 1) this.step--;
            this.renderModal();
        },
        captureData: function() {
            if (this.step === 1) {
                const titleInput = document.getElementById('cohort-title');
                const descInput = document.getElementById('cohort-desc');
                const thumbInput = document.getElementById('cohort-thumb');
                const priceInput = document.getElementById('cohort-price');
                if (titleInput) this.formData.title = titleInput.value;
                if (descInput) this.formData.description = descInput.value;
                if (thumbInput) this.formData.thumbnail_url = thumbInput.value;
                if (priceInput) this.formData.price = parseFloat(priceInput.value) || 0;
            }
            if (this.step === 2) {
                const startInput = document.getElementById('cohort-start-time');
                const endInput = document.getElementById('cohort-end-time');
                if (startInput) this.formData.start_time = startInput.value;
                if (endInput) this.formData.end_time = endInput.value;
            }
        },
        addModule: function() {
            const title = document.getElementById('cohort-mod-title').value;
            const live = document.getElementById('cohort-mod-live').value;
            const record = document.getElementById('cohort-mod-record').value;
            const materials = document.getElementById('cohort-mod-materials').value;
            if (title && live) {
                this.formData.modules.push({ title, live_link: live, video_url: record, materials_url: materials });
                this.renderModal();
            } else {
                alert('Title and Live Link are required');
            }
        },
        editCohort: async function(courseId) {
            const { data: course, error } = await supabase.from('courses').select('*, modules(*)').eq('id', courseId).single();
            if (error) return alert('Error fetching cohort data');

            this.formData = {
                course_id: courseId,
                is_edit: true,
                title: course.title,
                description: course.description,
                thumbnail_url: course.thumbnail_url,
                price: course.price,
                cohort_days: course.cohort_days || [],
                start_time: course.start_time || '',
                end_time: course.end_time || '',
                modules: course.modules.sort((a,b) => a.order_index - b.order_index).map(m => ({
                    title: m.title,
                    live_link: m.notes_url,
                    video_url: m.video_url,
                    materials_url: m.materials_url || ''
                }))
            };
            this.step = 1;
            this.renderModal();
        },
        createCohort: async function() {
            const btn = event.target;
            btn.disabled = true;
            btn.textContent = this.formData.is_edit ? 'Updating...' : 'Publishing...';

            try {
                const courseData = {
                    tutor_id: currentTutorId,
                    title: this.formData.title,
                    description: this.formData.description,
                    thumbnail_url: this.formData.thumbnail_url,
                    price: this.formData.price,
                    cohort_days: this.formData.cohort_days,
                    start_time: this.formData.start_time,
                    end_time: this.formData.end_time,
                    course_type: 'Live-Cohort',
                    status: 'Scheduled'
                };

                let courseId = this.formData.course_id;

                if (this.formData.is_edit) {
                    await supabase.from('courses').update(courseData).eq('id', courseId);
                    await supabase.from('modules').delete().eq('course_id', courseId);
                } else {
                    const { data: course, error } = await supabase.from('courses').insert(courseData).select().single();
                    if (error) throw error;
                    courseId = course.id;
                }

                if (this.formData.modules.length > 0) {
                    const moduleData = this.formData.modules.map((m, i) => ({
                        course_id: courseId,
                        title: m.title,
                        video_url: m.video_url,
                        notes_url: m.live_link,
                        materials_url: m.materials_url || null,
                        order_index: i
                    }));
                    await supabase.from('modules').insert(moduleData);
                }

                alert(this.formData.is_edit ? 'Cohort updated successfully!' : 'Cohort created successfully!');
                this.closeModal();
                loadCohorts(currentTutorId);
            } catch (err) {
                console.error(err);
                alert('Error: ' + err.message);
                btn.disabled = false;
                btn.textContent = 'Publish';
            }
        },
        renderModal: function() {
            let stepContent = '';
            if (this.step === 1) {
                stepContent = `
                    <div class="space-y-4">
                        <h3 class="font-bold text-gray-800">Basic Information</h3>
                        <input id="cohort-title" type="text" value="${this.formData.title}" placeholder="e.g., Python Live Bootcamp" class="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:border-green-600 transition">
                        <textarea id="cohort-desc" placeholder="Describe the cohort experience..." class="w-full p-2.5 border border-gray-200 rounded-lg h-24 outline-none focus:border-green-600 transition">${this.formData.description}</textarea>
                        <div class="flex gap-3 items-start">
                            <input id="cohort-thumb" type="url" value="${this.formData.thumbnail_url}" placeholder="Thumbnail Drive Link *" 
                                oninput="document.getElementById('cohort-thumb-preview').src = window.getThumbnailUrl(this.value)"
                                class="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:border-green-600 transition">
                            <div class="w-16 h-16 rounded-lg bg-gray-100 border border-gray-100 overflow-hidden shrink-0">
                                <img id="cohort-thumb-preview" src="${getThumbnailUrl(this.formData.thumbnail_url)}" class="w-full h-full object-cover">
                            </div>
                        </div>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
                            <input id="cohort-price" type="number" value="${this.formData.price}" placeholder="Course Price" class="w-full p-2.5 pl-8 border border-gray-200 rounded-lg outline-none focus:border-green-600 transition">
                        </div>
                    </div>
                `;
            } else if (this.step === 2) {
                stepContent = `
                    <div class="space-y-6">
                        <h3 class="font-bold text-gray-800">Schedule & Timings</h3>
                        <div class="flex gap-4 flex-wrap">
                            ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `
                                <button onclick="window.cohortState.toggleDay('${d}')" class="px-4 py-2 rounded-xl border text-sm font-medium transition ${this.formData.cohort_days.includes(d) ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200 hover:border-green-500'}">
                                    ${d}
                                </button>
                            `).join('')}
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="text-xs text-gray-500 font-bold mb-1 block">START TIME</label>
                                <input id="cohort-start-time" type="time" value="${this.formData.start_time}" class="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:border-green-600">
                            </div>
                            <div>
                                <label class="text-xs text-gray-500 font-bold mb-1 block">END TIME</label>
                                <input id="cohort-end-time" type="time" value="${this.formData.end_time}" class="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:border-green-600">
                            </div>
                        </div>
                    </div>
                `;
            } else if (this.step === 3) {
                stepContent = `
                    <div class="space-y-4">
                        <h3 class="font-bold text-gray-800">Add Live Session Modules</h3>
                        <div class="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                            <input id="cohort-mod-title" type="text" placeholder="Session Title (e.g., Intro to Hooks)" class="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-green-600">
                            <input id="cohort-mod-live" type="url" placeholder="Live Meet Link (e.g., Google Meet) *" class="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-green-600">
                            <input id="cohort-mod-materials" type="url" placeholder="Materials / Drive Link (Optional)" class="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-blue-600">
                            <input id="cohort-mod-record" type="url" placeholder="Recording URL (Optional)" class="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-green-600">
                            <button onclick="window.cohortState.addModule()" class="w-full bg-green-900 text-white font-bold py-2 rounded-lg hover:bg-black transition">Add Session</button>
                        </div>
                        <div class="space-y-2">
                            ${this.formData.modules.map((m, i) => `
                                <div class="p-3 bg-white border border-gray-100 rounded-lg shadow-sm flex justify-between items-center">
                                    <div>
                                        <span class="text-xs font-bold text-gray-800">${i+1}. ${m.title}</span>
                                        ${m.materials_url ? '<span class="ml-2 text-[9px] font-bold text-blue-500 uppercase">📎 Materials</span>' : ''}
                                    </div>
                                    <button onclick="window.cohortState.formData.modules.splice(${i}, 1); window.cohortState.renderModal()" class="text-red-400"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            } else if (this.step === 4) {
                stepContent = `
                    <div class="space-y-4">
                        <h3 class="font-bold text-gray-800">Final Review</h3>
                        <div class="border rounded-xl p-4 bg-white text-sm space-y-2">
                             <p><span class="text-gray-500">Title:</span> ${this.formData.title}</p>
                             <p><span class="text-gray-500">Days:</span> ${this.formData.cohort_days.join(', ')}</p>
                             <p><span class="text-gray-500">Time:</span> ${this.formData.start_time} - ${this.formData.end_time}</p>
                             <p><span class="text-gray-500">Sessions:</span> ${this.formData.modules.length}</p>
                        </div>
                    </div>
                `;
            }

            const modalHtml = `
                <div class="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 font-sans">
                    <div class="bg-white rounded-[24px] shadow-2xl w-full max-w-xl flex flex-col overflow-hidden animate-fadeIn">
                        <div class="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 class="text-xl font-bold text-gray-900">Create Cohort (${this.step}/4)</h2>
                            <button onclick="window.cohortState.closeModal()" class="text-gray-400 hover:text-gray-900 transition"><i data-lucide="x" class="w-5 h-5"></i></button>
                        </div>
                        <div class="p-8 overflow-y-auto max-h-[70vh]">
                            ${stepContent}
                        </div>
                        <div class="p-6 border-t border-gray-100 flex justify-between">
                            <button onclick="window.cohortState.prevStep()" class="px-6 py-2 border rounded-xl text-sm font-medium hover:bg-gray-50 transition ${this.step === 1 ? 'invisible' : ''}">Back</button>
                            <button onclick="window.cohortState.nextStep()" class="px-8 py-2 bg-green-700 text-white rounded-xl text-sm font-bold hover:bg-green-800 transition">
                                ${this.step === 4 ? 'Create Cohort' : 'Next'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('cohort-modal-container').innerHTML = modalHtml;
            window.getThumbnailUrl = getThumbnailUrl; // Expose for oninput
            lucide.createIcons();
        },
        runCohortClass: async function(courseId) {
            const { data: course, error } = await supabase.from('courses').select('*, modules(*)').eq('id', courseId).single();
            if (error) return alert('Error fetching cohort data');
            
            const modules = course.modules.sort((a,b) => a.order_index - b.order_index);
            
            const modalHtml = `
                <div class="fixed inset-0 bg-white flex flex-col z-[100] font-sans h-screen w-screen">
                    <div class="flex items-center justify-between px-8 py-5 border-b border-gray-100">
                        <div>
                            <h2 class="text-xl font-black text-gray-900">${course.title}</h2>
                            <p class="text-xs text-gray-400 mt-1">${course.cohort_days?.join(', ') || ''} • ${course.start_time?.slice(0,5) || ''} - ${course.end_time?.slice(0,5) || ''}</p>
                        </div>
                        <button onclick="window.cohortState.closeModal()" class="text-gray-400 hover:text-gray-900 transition p-2 hover:bg-gray-100"><i data-lucide="x" class="w-6 h-6"></i></button>
                    </div>
                    <div class="flex-1 flex overflow-hidden">
                        <div class="w-72 bg-gray-50 border-r border-gray-100 p-6 overflow-y-auto hidden md:block">
                            <h3 class="text-gray-400 text-[10px] font-black mb-4 tracking-widest uppercase">Sessions</h3>
                            ${modules.map((m, i) => `
                                <div class="mb-2">
                                    <button onclick="window.cohortState.startMeet('${m.notes_url}', '${m.title.replace(/'/g, "\\'")}')" class="w-full text-left p-4 border border-gray-200 bg-white hover:border-emerald-500 hover:bg-emerald-50 transition text-sm group">
                                        <div class="flex items-center gap-3">
                                            <div class="w-8 h-8 bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px] font-black shrink-0">${(i+1).toString().padStart(2,'0')}</div>
                                            <div class="font-bold text-gray-800 truncate group-hover:text-emerald-700">${m.title}</div>
                                        </div>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                        <div id="meet-container" class="flex-1 bg-white flex items-center justify-center p-8">
                            <div class="text-center">
                                <div class="w-20 h-20 bg-gray-50 flex items-center justify-center mx-auto mb-6 border border-gray-100">
                                    <i data-lucide="video" class="w-10 h-10 text-gray-300"></i>
                                </div>
                                <p class="text-gray-400 text-sm">Select a session from the left to launch Google Meet</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('cohort-modal-container').innerHTML = modalHtml;
            lucide.createIcons();
            
            // Automatically select first if available
            if (modules.length > 0 && modules[0].notes_url) {
                 this.startMeet(modules[0].notes_url, modules[0].title);
            }
        },
        startMeet: function(url, title) {
            const container = document.getElementById('meet-container');
            if (!url) {
                container.innerHTML = '<div class="text-gray-400 text-sm">No meet link provided for this session.</div>';
                return;
            }
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center text-center w-full max-w-lg mx-auto">
                    <div class="w-24 h-24 bg-emerald-50 flex items-center justify-center mb-8 border border-emerald-100">
                        <i data-lucide="video" class="w-12 h-12 text-emerald-600"></i>
                    </div>
                    <h3 class="text-2xl font-black text-gray-900 mb-2">${title || 'Live Session'}</h3>
                    <p class="text-sm text-gray-500 mb-8 max-w-sm">Click the button below to open Google Meet. All enrolled students can join this session.</p>
                    <a href="${url}" target="_blank" class="inline-flex items-center gap-3 bg-emerald-600 text-white font-bold px-10 py-4 hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 text-sm mb-6">
                        <i data-lucide="video" class="w-5 h-5"></i>
                        Start Google Meet
                        <i data-lucide="external-link" class="w-4 h-4 opacity-60"></i>
                    </a>
                    <div class="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 px-5 py-3 border border-gray-100">
                        <i data-lucide="message-circle" class="w-4 h-4 text-blue-400 shrink-0"></i>
                        <span>Use the <strong class="text-gray-600">Google Meet chat</strong> inside the meeting for live Q&A</span>
                    </div>
                </div>
            `;
            lucide.createIcons();
        }
    };
    
    loadCohorts(currentTutorId);
}

async function loadCohorts(tutorId) {
    const list = document.getElementById('cohort-courses-list');
    const { data: cohorts, error } = await supabase
        .from('courses')
        .select(`*, modules(count)`)
        .eq('tutor_id', tutorId)
        .eq('course_type', 'Live-Cohort');

    if (error) {
        list.innerHTML = `<p class="text-red-500">Error: ${error.message}</p>`;
        return;
    }

    if (!cohorts?.length) {
        list.innerHTML = `<div class="flex items-center justify-center h-48 text-gray-400">No cohorts found</div>`;
        return;
    }

    list.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            ${cohorts.map(c => `
                <div class="p-5 border border-gray-100 rounded-2xl bg-white shadow-sm flex justify-between items-center group hover:border-green-100 transition">
                    <div class="flex gap-4 items-center">
                        <div class="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden">
                            <img src="${getThumbnailUrl(c.thumbnail_url)}" class="w-full h-full object-cover">
                        </div>
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <h4 class="font-bold text-gray-900">${c.title}</h4>
                                <span class="status-badge ${c.status === 'Scheduled' ? 'status-scheduled' : 'status-live'}">${c.status}</span>
                            </div>
                            <div class="flex items-center gap-3 text-[10px] text-gray-500">
                                <span class="flex items-center gap-1 uppercase font-bold tracking-tighter">${c.cohort_days?.join(' ')}</span>
                                <span>•</span>
                                <span>${c.start_time?.slice(0,5)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                        <button onclick="window.cohortState.runCohortClass('${c.id}')" class="text-white bg-emerald-600 hover:bg-emerald-700 transition px-3 py-1.5 text-xs font-bold flex items-center gap-1.5"><i data-lucide="video" class="w-3.5 h-3.5"></i> Run Class</button>
                        <button onclick="window.cohortState.editCohort('${c.id}')" class="text-gray-400 hover:text-green-600 transition"><i data-lucide="edit-3" class="w-5 h-5"></i></button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    lucide.createIcons();
}
