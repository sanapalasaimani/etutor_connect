import { supabase } from '../../src/supabase.js';
import { getThumbnailUrl } from '../../src/utils.js';


export async function renderSelfPacedView(containerId) {
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
                    Self-Paced Courses
                </h2>
                <p class="text-gray-500 text-sm">Pre-recorded video courses with quizzes</p>
            </div>
            <button onclick="window.spState.openCreateModal()" class="ml-auto bg-green-700 text-white px-4 py-2 text-sm font-medium rounded animate-fadeIn transition hover:bg-green-800 flex items-center gap-2 shadow-sm relative pl-8">
                <i data-lucide="plus" class="w-4 h-4 absolute left-3"></i>
                Create New Course
            </button>
        </div>

        <div class="flex gap-2 mb-6 border-b border-gray-100">
            <button class="px-5 py-2.5 bg-gray-50/70 border border-gray-200 border-b-0 text-sm font-medium rounded-t-xl text-gray-800 shadow-sm relative top-[1px]">Existing Courses</button>
        </div>

        <div class="bg-white border border-gray-200 rounded-xl p-8 mb-8">
            <p class="font-medium text-gray-800 mb-6 border-b pb-4">Your Self-Paced Courses</p>
            <div id="sp-courses-list" class="min-h-[250px]">
                <div class="flex items-center justify-center h-full py-20 text-gray-400">
                    <p>Loading courses...</p>
                </div>
            </div>
        </div>
        
        <!-- Modal Container -->
        <div id="sp-modal-container"></div>
    `;

    lucide.createIcons();

    window.spState = {
        formData: {
            is_edit: false,
            course_id: null,
            title: '',
            description: '',
            thumbnail_url: '',
            demo_video_url: '',
            price: 0,
            is_free: false,
            has_quizzes: false,
            modules: [] // { title, video_url, notes_url, quizzes: [{question, options:[], correct_idx}] }
        },
        openCreateModal: function() {
            if (!window.verifyPayoutDetails()) return;
            this.step = 1;
            this.formData = { is_edit: false, course_id: null, title: '', description: '', thumbnail_url: '', demo_video_url: '', price: 0, is_free: false, has_quizzes: false, modules: [] };
            this.renderModal();
        },
        editCourse: async function(courseId) {
            console.log('Editing course:', courseId);
            const { data: course, error: cError } = await supabase.from('courses').select('*, modules(*)').eq('id', courseId).single();
            if (cError) return alert('Error fetching course data');

            // Fetch quizzes for these modules
            const moduleIds = course.modules.map(m => m.id);
            const { data: quizzesData } = await supabase.from('quizzes').select('*').in('module_id', moduleIds);

            this.formData = {
                is_edit: true,
                course_id: courseId,
                title: course.title,
                description: course.description,
                thumbnail_url: course.thumbnail_url,
                demo_video_url: course.demo_video_url || '',
                price: course.price,
                is_free: course.price <= 0,
                has_quizzes: course.modules.some(m => m.has_quiz),
                modules: course.modules.sort((a,b) => a.order_index - b.order_index).map(m => {
                    const qData = quizzesData?.find(q => q.module_id === m.id);
                    return {
                        id: m.id,
                        title: m.title,
                        video_url: m.video_url || '',
                        notes_url: m.notes_url || '',
                        quizzes: qData ? qData.questions : []
                    };
                })
            };
            this.step = 1;
            this.renderModal();
        },
        closeModal: function() {
            document.getElementById('sp-modal-container').innerHTML = '';
        },
        nextStep: function() {
            this.captureData();
            
            // Validation for Step 1
            if (this.step === 1) {
                if (!this.formData.title.trim() || !this.formData.description.trim() || !this.formData.thumbnail_url.trim() || !this.formData.demo_video_url.trim()) {
                    alert('All fields including Demo Video are mandatory!');
                    return;
                }
                if (!this.formData.is_free && (this.formData.price <= 0)) {
                    alert('Please set a price or select Free.');
                    return;
                }
            }

            // Validation for Step 2
            if (this.step === 2) {
                if (this.formData.modules.length === 0) {
                    alert('At least one module is mandatory!');
                    return;
                }
            }

            // Validation for Step 3 (Quizzes)
            if (this.step === 3 && this.formData.has_quizzes) {
                const incomplete = this.formData.modules.some(m => !m.quizzes || m.quizzes.length < 5);
                if (incomplete) {
                    alert('Each module must have 5 MCQs if Quizzes are enabled.');
                    return;
                }
            }

            if (this.step < 5) {
                this.step++;
                this.renderModal();
            } else {
                this.publishCourse();
            }
        },
        prevStep: function() {
            this.captureData();
            if (this.step > 1) this.step--;
            this.renderModal();
        },
        captureData: function() {
            if (this.step === 1) {
                this.formData.title = document.getElementById('sp-course-title').value;
                this.formData.description = document.getElementById('sp-course-desc').value;
                this.formData.thumbnail_url = document.getElementById('sp-course-thumb').value;
                this.formData.demo_video_url = document.getElementById('sp-course-demo').value;
                this.formData.has_quizzes = this.formData.has_quizzes || false; // Keep quiz toggle state
                this.formData.is_free = document.getElementById('sp-course-free').checked;
                this.formData.price = this.formData.is_free ? 0 : parseFloat(document.getElementById('sp-course-price').value) || 0;
            }
        },
        addModule: function() {
            const title = document.getElementById('mod-title').value;
            const video = document.getElementById('mod-video').value;
            const materials = document.getElementById('mod-materials').value;
            
            if (title.trim() && video.trim() && materials.trim()) {
                this.formData.modules.push({
                    title: title.trim(),
                    video_url: video.trim(),
                    notes_url: materials.trim(),
                    quizzes: []
                });
                this.renderModal();
            } else {
                alert('Title, Video URL, and Materials Link are all mandatory!');
            }
        },
        saveQuizQuestion: function(moduleIdx, questionIdx) {
            const q = document.getElementById(`q-${moduleIdx}-${questionIdx}`).value;
            const opts = [
                document.getElementById(`opt-${moduleIdx}-${questionIdx}-0`).value,
                document.getElementById(`opt-${moduleIdx}-${questionIdx}-1`).value,
                document.getElementById(`opt-${moduleIdx}-${questionIdx}-2`).value,
                document.getElementById(`opt-${moduleIdx}-${questionIdx}-3`).value
            ];
            const correct = parseInt(document.getElementById(`correct-${moduleIdx}-${questionIdx}`).value);

            if (!this.formData.modules[moduleIdx].quizzes) this.formData.modules[moduleIdx].quizzes = [];
            this.formData.modules[moduleIdx].quizzes[questionIdx] = {
                question: q,
                options: opts,
                correct_idx: correct
            };
        },
        publishCourse: async function() {
            const btn = event.target;
            btn.disabled = true;
            btn.textContent = this.formData.is_edit ? 'Updating...' : 'Publishing...';

            try {
                const courseData = {
                    tutor_id: currentTutorId,
                    title: this.formData.title,
                    description: this.formData.description,
                    thumbnail_url: this.formData.thumbnail_url,
                    demo_video_url: this.formData.demo_video_url,
                    price: this.formData.price,
                    course_type: 'Self-Paced',
                    status: 'Live',
                    min_pass_percent: 60,
                    certificate_offered: false
                };

                let courseId = this.formData.course_id;

                if (this.formData.is_edit) {
                    const { error: updateErr } = await supabase.from('courses').update(courseData).eq('id', courseId);
                    if (updateErr) throw updateErr;
                    
                    // Order of deletion matters for Foreign Keys: Quizzes first
                    await supabase.from('quizzes').delete().eq('course_id', courseId);
                    await supabase.from('modules').delete().eq('course_id', courseId);
                } else {
                    const { data: course, error } = await supabase.from('courses').insert(courseData).select().single();
                    if (error) throw error;
                    courseId = course.id;
                }

                // Insert Modules and Quizzes
                for (let i = 0; i < this.formData.modules.length; i++) {
                    const m = this.formData.modules[i];
                    const { data: module, error: mErr } = await supabase.from('modules').insert({
                        course_id: courseId,
                        title: m.title,
                        video_url: m.video_url,
                        notes_url: m.notes_url,
                        order_index: i,
                        has_quiz: this.formData.has_quizzes && m.quizzes?.length >= 5
                    }).select().single();
                    
                    if (mErr) throw mErr;

                    if (this.formData.has_quizzes && m.quizzes?.length >= 5) {
                        await supabase.from('quizzes').insert({
                            course_id: courseId,
                            module_id: module.id,
                            questions: m.quizzes
                        });
                    }
                }

                alert(this.formData.is_edit ? 'Course updated successfully!' : 'Course published successfully!');
                this.closeModal();
                loadSPCourses(currentTutorId);
            } catch (err) {
                console.error(err);
                alert('Error: ' + err.message);
                btn.disabled = false;
                btn.textContent = this.formData.is_edit ? 'Update' : 'Publish';
            }
        },
        renderModal: function() {
            const getStepClass = (s) => s === this.step ? 'bg-green-700 text-white' : (s < this.step ? 'bg-green-200 text-green-800' : 'bg-gray-100 text-gray-400');
            const getLineClass = (s) => s < this.step ? 'bg-green-700' : 'bg-gray-100';

            let content = '';
            if (this.step === 1) {
                content = `
                    <div class="mb-5 flex items-center gap-2"><i data-lucide="book-open" class="w-5 h-5 text-gray-700"></i> <h3 class="font-bold text-lg">Course Information</h3></div>
                    <div class="space-y-5">
                        <div>
                            <label class="block text-sm font-medium mb-1 text-gray-700">Course Title *</label>
                            <input type="text" id="sp-course-title" value="${this.formData.title}" placeholder="e.g., AI Engineer Bootcamp" class="w-full p-2.5 border border-green-600 rounded-lg outline-none focus:ring-1 focus:ring-green-600 bg-white shadow-sm border-[1.5px] transition text-gray-800">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1 text-gray-700">Description *</label>
                            <textarea id="sp-course-desc" placeholder="Describe what students will learn..." class="w-full p-3 border border-gray-200 rounded-lg h-28 outline-none focus:border-green-600 shadow-sm transition text-gray-800">${this.formData.description}</textarea>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1 text-gray-700">Thumbnail URL *</label>
                            <div class="flex gap-3 items-start">
                                <input type="url" id="sp-course-thumb" value="${this.formData.thumbnail_url}" placeholder="Link to course thumbnail image" 
                                    oninput="document.getElementById('thumb-preview').src = window.getThumbnailUrl(this.value)"
                                    class="w-full p-2.5 border border-gray-200 rounded-lg outline-none shadow-sm focus:border-green-600 transition text-gray-800">
                                <div class="w-24 h-24 rounded-lg bg-gray-100 border border-gray-100 overflow-hidden shrink-0">
                                    <img id="thumb-preview" src="${getThumbnailUrl(this.formData.thumbnail_url)}" class="w-full h-full object-cover">
                                </div>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1 text-gray-700">Demo Video (Drive Link) *</label>
                            <input type="url" id="sp-course-demo" value="${this.formData.demo_video_url}" placeholder="Google Drive sharing link for demo video" class="w-full p-2.5 border border-gray-200 rounded-lg outline-none shadow-sm focus:border-green-600 transition text-gray-800">
                        </div>
                        <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <label class="block text-sm font-medium mb-3 text-gray-700">Pricing Strategy *</label>
                            <div class="flex gap-6">
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="pricing" id="sp-course-free" ${this.formData.is_free ? 'checked' : ''} onchange="document.getElementById('sp-course-price').disabled = true; document.getElementById('sp-price-container').style.opacity = '0.5'">
                                    <span class="text-sm font-medium text-gray-800">Free Course</span>
                                </label>
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="pricing" id="sp-course-paid" ${!this.formData.is_free ? 'checked' : ''} onchange="document.getElementById('sp-course-price').disabled = false; document.getElementById('sp-price-container').style.opacity = '1'">
                                    <span class="text-sm font-medium text-gray-800">Set Price</span>
                                </label>
                            </div>
                            <div id="sp-price-container" class="mt-4 ${this.formData.is_free ? 'opacity-50' : ''}">
                                <div class="relative">
                                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                                    <input type="number" id="sp-course-price" value="${this.formData.price}" ${this.formData.is_free ? 'disabled' : ''} placeholder="Amount in INR" class="w-full p-2.5 pl-8 border border-gray-200 rounded-lg outline-none shadow-sm focus:border-green-600 transition text-gray-800">
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            } else if (this.step === 2) {
                content = `
                    <div class="mb-5 flex items-center gap-2"><i data-lucide="play-circle" class="w-5 h-5 text-gray-700"></i> <h3 class="font-bold text-lg">Course Modules</h3></div>
                    <div class="space-y-4 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <div class="grid grid-cols-1 gap-3">
                            <input id="mod-title" type="text" placeholder="Module Title (e.g., Intro to Neural Networks)" class="p-2.5 border border-gray-200 rounded-lg outline-none focus:border-green-600 transition shadow-sm">
                            <input id="mod-video" type="url" placeholder="Video URL (Google Drive/YouTube)" class="p-2.5 border border-gray-200 rounded-lg outline-none focus:border-green-600 transition shadow-sm">
                            <input id="mod-materials" type="url" placeholder="Materials Link (Google Drive/PDF)" class="p-2.5 border border-gray-200 rounded-lg outline-none focus:border-green-600 transition shadow-sm">
                        </div>
                        <button onclick="window.spState.addModule()" class="w-full bg-green-900 text-white font-bold py-3 rounded-lg hover:bg-black shadow-lg transition flex items-center justify-center gap-2">
                            <i data-lucide="plus-circle" class="w-5 h-5"></i>
                            Add Module
                        </button>
                    </div>
                    <div class="space-y-3 mb-4">
                        <p class="text-xs font-bold text-gray-400 uppercase tracking-wider">Added Modules (${this.formData.modules.length})</p>
                        ${this.formData.modules.map((m, i) => `
                            <div class="flex flex-col p-4 bg-white border border-gray-100 rounded-xl shadow-sm group">
                                <div class="flex justify-between items-center mb-2">
                                    <span class="text-sm font-bold text-gray-900">${i+1}. ${m.title}</span>
                                    <button onclick="window.spState.formData.modules.splice(${i}, 1); window.spState.renderModal();" class="text-red-400 hover:text-red-600 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                                </div>
                                <div class="flex items-center gap-4 text-[11px] text-gray-500">
                                    <span class="flex items-center gap-1"><i data-lucide="video" class="w-3 h-3"></i> Video Added</span>
                                    <span class="flex items-center gap-1"><i data-lucide="file-text" class="w-3 h-3"></i> Materials Linked</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else if (this.step === 3) {
                content = `
                    <div class="mb-5 flex items-center gap-2"><i data-lucide="help-circle" class="w-5 h-5 text-gray-700"></i> <h3 class="font-bold text-lg">Quizzes Configuration</h3></div>
                    <div class="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <label class="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" id="has-quizzes-toggle" ${this.formData.has_quizzes ? 'checked' : ''} onchange="window.spState.formData.has_quizzes = this.checked; window.spState.renderModal();" class="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-600">
                            <span class="font-semibold text-gray-800">Include Quizzes in this course</span>
                        </label>
                    </div>

                    ${this.formData.has_quizzes ? `
                        <div class="space-y-8">
                            <div class="p-3 bg-blue-50 text-blue-700 text-xs rounded-lg border border-blue-100">
                                <i data-lucide="info" class="w-3 h-3 inline mr-1"></i> You must provide 5 MCQs for each module. Pass percentage is set to 60%.
                            </div>
                            ${this.formData.modules.map((m, mIdx) => `
                                <div class="border border-gray-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                                    <div class="bg-gray-50 p-4 border-b border-gray-200 font-bold text-gray-800 flex items-center justify-between">
                                        <span>Module ${mIdx+1}: ${m.title}</span>
                                        <span class="text-xs ${m.quizzes?.filter(q=>q).length === 5 ? 'text-green-600' : 'text-orange-500'} bg-white px-2 py-1 rounded-full border">
                                            ${m.quizzes?.filter(q=>q).length || 0} / 5 Done
                                        </span>
                                    </div>
                                    <div class="p-6 space-y-8">
                                        ${[0,1,2,3,4].map(qIdx => `
                                            <div class="space-y-3">
                                                <p class="text-sm font-bold text-emerald-700">Question ${qIdx+1}</p>
                                                <input type="text" id="q-${mIdx}-${qIdx}" value="${m.quizzes?.[qIdx]?.question || ''}" placeholder="Type question here..." onchange="window.spState.saveQuizQuestion(${mIdx}, ${qIdx})" class="w-full p-2 border-b-2 border-gray-100 outline-none focus:border-green-600 transition text-sm">
                                                <div class="grid grid-cols-2 gap-3">
                                                    ${[0,1,2,3].map(optIdx => `
                                                        <div class="flex items-center gap-2">
                                                            <span class="text-[10px] text-gray-400 font-bold">${String.fromCharCode(65 + optIdx)}</span>
                                                            <input type="text" id="opt-${mIdx}-${qIdx}-${optIdx}" value="${m.quizzes?.[qIdx]?.options?.[optIdx] || ''}" placeholder="Option ${optIdx+1}" onchange="window.spState.saveQuizQuestion(${mIdx}, ${qIdx})" class="flex-1 p-2 bg-gray-50 rounded text-xs outline-none focus:bg-white border border-transparent focus:border-gray-200">
                                                        </div>
                                                    `).join('')}
                                                </div>
                                                <div class="flex items-center gap-2 mt-2">
                                                    <span class="text-xs text-gray-500">Correct Answer:</span>
                                                    <select id="correct-${mIdx}-${qIdx}" onchange="window.spState.saveQuizQuestion(${mIdx}, ${qIdx})" class="text-xs p-1 rounded border border-gray-200 outline-none">
                                                        <option value="0" ${m.quizzes?.[qIdx]?.correct_idx === 0 ? 'selected' : ''}>Option A</option>
                                                        <option value="1" ${m.quizzes?.[qIdx]?.correct_idx === 1 ? 'selected' : ''}>Option B</option>
                                                        <option value="2" ${m.quizzes?.[qIdx]?.correct_idx === 2 ? 'selected' : ''}>Option C</option>
                                                        <option value="3" ${m.quizzes?.[qIdx]?.correct_idx === 3 ? 'selected' : ''}>Option D</option>
                                                    </select>
                                                </div>
                                            </div>
                                        `).join('<hr class="border-gray-50">')}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="py-20 text-center text-gray-400">
                            <i data-lucide="shield-off" class="w-12 h-12 mx-auto mb-4 opacity-20"></i>
                            <p>No quizzes will be included in this course.</p>
                        </div>
                    `}
                `;
            } else if (this.step === 4) {
                 content = `
                    <div class="mb-6 flex items-center gap-2"><i data-lucide="award" class="w-5 h-5 text-gray-700"></i> <h3 class="font-bold text-lg">Certificate Settings</h3></div>
                    <div class="bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-12 text-center">
                        <div class="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                            <i data-lucide="slash" class="w-8 h-8 text-gray-300"></i>
                        </div>
                        <h4 class="font-bold text-gray-600 mb-2">No Certificates</h4>
                        <p class="text-sm text-gray-400">Certificates are currently not enabled for this course type.</p>
                    </div>
                `;
            } else if (this.step === 5) {
                 content = `
                    <div class="mb-6 flex items-center gap-2"><i data-lucide="check-circle" class="w-5 h-5 text-gray-700"></i> <h3 class="font-bold text-lg">Review & Publish</h3></div>
                    <div class="space-y-0 text-sm text-gray-700 border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-100 bg-white shadow-sm">
                        <div class="flex justify-between p-4 px-5"><span class="text-gray-500 font-medium font-sans">Title</span><span class="text-gray-800 font-semibold">${this.formData.title || 'Not set'}</span></div>
                        <div class="flex justify-between p-4 px-5"><span class="text-gray-500 font-medium font-sans">Thumbnail</span><span class="text-emerald-600 font-medium truncate max-w-[200px]">${this.formData.thumbnail_url || 'Not set'}</span></div>
                        <div class="flex justify-between p-4 px-5"><span class="text-gray-500 font-medium font-sans">Demo Video</span><span class="text-emerald-600 font-medium truncate max-w-[200px]">${this.formData.demo_video_url || 'Not set'}</span></div>
                        <div class="flex justify-between p-4 px-5"><span class="text-gray-500 font-medium font-sans">Modules</span><span class="text-gray-800 font-semibold">${this.formData.modules.length} modules</span></div>
                        <div class="flex justify-between p-4 px-5"><span class="text-gray-500 font-medium font-sans">Quizzes</span><span class="text-gray-800 font-semibold">${this.formData.has_quizzes ? 'Yes (5 MCQs/Module)' : 'No'}</span></div>
                        <div class="flex justify-between p-4 px-5"><span class="text-gray-500 font-medium font-sans">Price</span><span class="text-gray-800 font-bold">${this.formData.is_free ? '<span class="text-emerald-600">Free</span>' : `₹${this.formData.price}`}</span></div>
                    </div>
                    <div class="mt-4 p-4 bg-orange-50 border border-orange-100 rounded-xl text-[11px] text-orange-700">
                        <i data-lucide="alert-triangle" class="w-3 h-3 inline mr-1"></i> Pass percentage is set to 60%. All modules must have valid video/materials links.
                    </div>
                `;
            }

            const modalHtml = `
                <div class="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div class="bg-[#fafafa] rounded-[20px] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn">
                        <div class="px-6 py-5 flex justify-between items-center bg-white border-b border-gray-100">
                            <h2 class="text-xl font-bold text-gray-900">Create Self-Paced Course</h2>
                            <button onclick="window.spState.closeModal()" class="text-gray-400 hover:text-gray-600"><i data-lucide="x" class="w-5 h-5"></i></button>
                        </div>
                        <div class="px-8 py-8 flex items-center justify-between relative bg-white border-b border-gray-50/50">
                            <div class="absolute left-[3.5rem] right-[3.5rem] top-1/2 h-[3px] bg-gray-100 -translate-y-1/2 rounded-full"></div>
                            <div class="flex absolute left-[3.5rem] right-[3.5rem] top-1/2 h-[3px] -translate-y-1/2 rounded-full overflow-hidden">
                                <div class="w-1/4 ${getLineClass(1)} transition-all duration-300"></div>
                                <div class="w-1/4 ${getLineClass(2)} transition-all duration-300"></div>
                                <div class="w-1/4 ${getLineClass(3)} transition-all duration-300"></div>
                                <div class="w-1/4 ${getLineClass(4)} transition-all duration-300"></div>
                            </div>
                            ${[1, 2, 3, 4, 5].map(s => `<div class="w-[36px] h-[36px] rounded-full flex items-center justify-center text-[14px] font-bold ${getStepClass(s)} z-10 shadow-sm transition-colors duration-300 ring-4 ring-white">${s}</div>`).join('')}
                        </div>
                        <div class="p-8 overflow-y-auto flex-1 bg-[#fafafa]">${content}</div>
                        <div class="px-8 py-5 border-t border-gray-200/60 bg-white flex justify-between items-center">
                            <button onclick="window.spState.prevStep()" class="px-6 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition shadow-sm ${this.step === 1 ? 'invisible' : ''}">Previous</button>
                            <button onclick="window.spState.nextStep()" class="px-6 py-2.5 bg-green-700 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-green-800 hover:shadow transition ml-auto flex items-center gap-2">
                                ${this.step === 5 ? (this.formData.is_edit ? 'Update Course' : 'Publish Course') : 'Next'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('sp-modal-container').innerHTML = modalHtml;
            window.getThumbnailUrl = getThumbnailUrl; // Expose for oninput
            lucide.createIcons();
        }
    };
    
    loadSPCourses(currentTutorId);
}

async function loadSPCourses(tutorId) {
    const list = document.getElementById('sp-courses-list');
    const { data: courses, error } = await supabase
        .from('courses')
        .select(`*, modules(count)`)
        .eq('tutor_id', tutorId)
        .eq('course_type', 'Self-Paced');

    if (error) {
        list.innerHTML = `<p class="text-red-500">Error loading courses: ${error.message}</p>`;
        return;
    }

    if (!courses?.length) {
        list.innerHTML = `<div class="flex items-center justify-center h-48 text-gray-400">No courses found</div>`;
        return;
    }

    list.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${courses.map(c => `
                <div class="p-5 border border-gray-100 rounded-2xl hover:border-green-200 transition bg-white shadow-sm flex justify-between items-center group">
                    <div class="flex gap-4 items-center">
                        <div class="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden">
                            <img src="${getThumbnailUrl(c.thumbnail_url)}" class="w-full h-full object-cover">
                        </div>
                        <div>
                            <h4 class="font-bold text-gray-900 mb-1">${c.title}</h4>
                            <div class="flex items-center gap-3 text-xs text-gray-500">
                                <span class="flex items-center gap-1"><i data-lucide="layers" class="w-3 h-3"></i> ${c.modules?.[0]?.count || 0} Modules</span>
                                <span class="flex items-center gap-1"><i data-lucide="indian-rupee" class="w-3 h-3"></i> ${c.price === 0 ? 'Free' : c.price}</span>
                            </div>
                        </div>
                    </div>
                    <button onclick="window.spState.editCourse('${c.id}')" class="p-2 text-gray-400 hover:text-green-600 transition opacity-0 group-hover:opacity-100"><i data-lucide="edit-3" class="w-5 h-5"></i></button>
                </div>
            `).join('')}
        </div>
    `;
    lucide.createIcons();
}
