const { createApp, ref, reactive, computed, onMounted, nextTick } = Vue;

// QR Modal Component
const QrModal = {
    emits: ['credentials-loaded'],
    setup(props, { emit }) {
        const errorMessage = ref('');
        const statusMessage = ref('');
        const statusType = ref('info');
        const isScanning = ref(false);
        
        let html5QrCode = null;
        let scanning = false;

        const showStatus = (message, type = 'info') => {
            statusMessage.value = message;
            statusType.value = type;
        };

        const hideStatus = () => {
            statusMessage.value = '';
            statusType.value = 'info';
        };

        const handleDecoded = (decodedText) => {
            try {
                const credsObj = JSON.parse(decodedText);
                showStatus('✅ Credentials verified successfully!', 'success');
                
                setTimeout(() => {
                    localStorage.setItem('creds', JSON.stringify(credsObj));
                    emit('credentials-loaded', credsObj);
                }, 800);
            } catch (e) {
                errorMessage.value = '❌ Invalid QR code: Please ensure it contains valid credential data.';
                hideStatus();
            }
        };

        const startWebcam = () => {
            errorMessage.value = '';
            hideStatus();
            
            const qrContainer = document.getElementById('qr-reader');
            qrContainer.innerHTML = '';
            showStatus('📷 Starting camera...', 'scanning');
            
            html5QrCode = new Html5Qrcode('qr-reader');
            scanning = true;
            
            html5QrCode.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 240, height: 240 } },
                (decodedText) => {
                    if (scanning) {
                        scanning = false;
                        html5QrCode.stop().then(() => html5QrCode.clear());
                        handleDecoded(decodedText);
                    }
                },
                (errorMessage) => {
                    // Ignore scan errors - they're expected during scanning
                }
            ).then(() => {
                showStatus('🔍 Point camera at QR code', 'scanning');
            }).catch((err) => {
                errorMessage.value = '❌ Camera access denied or unavailable. Please check permissions.';
                hideStatus();
            });
        };

        const uploadImage = () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.style.display = 'none';
            
            fileInput.onchange = (e) => {
                if (!e.target.files.length) return;
                
                const imageFile = e.target.files[0];
                showStatus('🔍 Processing image...', 'scanning');
                
                if (html5QrCode) {
                    html5QrCode.clear();
                } else {
                    html5QrCode = new Html5Qrcode('qr-reader');
                }
                
                scanning = false;
                html5QrCode.scanFile(imageFile, true)
                    .then(decodedText => {
                        handleDecoded(decodedText);
                    })
                    .catch(err => {
                        errorMessage.value = '❌ No QR code found in image. Please try a clearer image.';
                        hideStatus();
                    });
            };
            
            document.body.appendChild(fileInput);
            fileInput.click();
            document.body.removeChild(fileInput);
        };

        return {
            errorMessage,
            statusMessage,
            statusType,
            isScanning,
            startWebcam,
            uploadImage
        };
    },
    template: `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" style="backdrop-filter: blur(8px);">
            <div class="bg-white rounded-lg shadow-lg w-full max-w-lg p-6 relative" style="background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);">
                <h2 class="text-xl font-semibold mb-4 text-center">Scan QR Code for Credentials</h2>
                <p class="text-gray-600 text-center mb-6">Use your camera or upload an image to authenticate</p>
                
                <div v-if="errorMessage" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                    {{ errorMessage }}
                </div>
                
                <div id="qr-reader" class="mx-auto mb-6 w-70 h-70 border-3 border-gray-200 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                    <div class="text-gray-400 text-center">
                        <div class="text-5xl mb-2">📷</div>
                        <div>Camera will appear here</div>
                    </div>
                </div>
                
                <div v-if="statusMessage" :class="statusType === 'scanning' ? 'scanning-indicator bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'" class="text-center py-2 px-4 rounded mb-4">
                    {{ statusMessage }}
                </div>
                
                <div class="flex gap-4 justify-center">
                    <button @click="startWebcam" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-semibold">
                        📹 Scan with Camera
                    </button>
                    <button @click="uploadImage" class="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded font-semibold">
                        📁 Upload Image
                    </button>
                </div>
            </div>
        </div>
    `
};

// Image Modal Component
const ImageModal = {
    props: ['images', 'currentIndex'],
    emits: ['close'],
    setup(props, { emit }) {
        const currentImageIndex = ref(props.currentIndex || 0);
        const isTransitioning = ref(false);
        let touchStartX = null;
        let touchStartY = null;
        
        const totalImages = computed(() => props.images?.length || 0);
        
        const currentImage = computed(() => {
            return props.images?.[currentImageIndex.value] || null;
        });
        
        const goToPrevious = () => {
            if (isTransitioning.value) return;
            if (currentImageIndex.value > 0) {
                isTransitioning.value = true;
                currentImageIndex.value--;
                setTimeout(() => isTransitioning.value = false, 300);
            }
        };
        
        const goToNext = () => {
            if (isTransitioning.value) return;
            if (currentImageIndex.value < totalImages.value - 1) {
                isTransitioning.value = true;
                currentImageIndex.value++;
                setTimeout(() => isTransitioning.value = false, 300);
            }
        };
        
        const handleTouchStart = (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        };
        
        const handleTouchMove = (e) => {
            // Prevent scrolling while swiping
            e.preventDefault();
        };
        
        const handleTouchEnd = (e) => {
            if (!touchStartX || !touchStartY) return;
            
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            
            const deltaX = touchStartX - touchEndX;
            const deltaY = touchStartY - touchEndY;
            
            const minSwipeDistance = 50;
            
            // Only respond to horizontal swipes
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
                if (deltaX > 0) {
                    // Swiped left, go to next image
                    goToNext();
                } else {
                    // Swiped right, go to previous image
                    goToPrevious();
                }
            }
            
            touchStartX = null;
            touchStartY = null;
        };
        
        const handleKeydown = (e) => {
            switch (e.key) {
                case 'Escape':
                    emit('close');
                    break;
                case 'ArrowLeft':
                    goToPrevious();
                    break;
                case 'ArrowRight':
                    goToNext();
                    break;
            }
        };
        
        const closeModal = () => {
            stopKeydownListener();
            emit('close');
        };
        
        // Watch for prop changes
        Vue.watch(() => props.currentIndex, (newIndex) => {
            if (newIndex !== undefined && newIndex !== null) {
                currentImageIndex.value = newIndex;
            }
        });
        
        let keydownHandler = null;
        
        onMounted(() => {
            keydownHandler = handleKeydown;
            document.addEventListener('keydown', keydownHandler);
        });
        
        // Return cleanup function so Vue can call it when component unmounts
        const stopKeydownListener = () => {
            if (keydownHandler) {
                document.removeEventListener('keydown', keydownHandler);
                keydownHandler = null;
            }
        };
        
        return {
            currentImageIndex,
            totalImages,
            currentImage,
            isTransitioning,
            goToPrevious,
            goToNext,
            handleTouchStart,
            handleTouchMove,
            handleTouchEnd,
            closeModal,
            stopKeydownListener
        };
    },
    template: `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 image-modal-overlay" @click.self="closeModal">
            <div class="relative max-w-4xl max-h-full mx-4">
                <!-- Close button -->
                <button @click="closeModal" class="absolute top-4 right-4 z-10 text-white hover:text-gray-300 text-3xl font-bold image-modal-nav-button rounded-full w-12 h-12 flex items-center justify-center">
                    ×
                </button>
                
                <!-- Image container -->
                <div class="relative bg-black rounded-lg overflow-hidden" 
                     @touchstart="handleTouchStart"
                     @touchmove="handleTouchMove" 
                     @touchend="handleTouchEnd"
                     style="touch-action: none;">
                    
                    <img v-if="currentImage" 
                         :src="currentImage" 
                         :alt="'Image ' + (currentImageIndex + 1)"
                         class="max-w-full max-h-[80vh] object-contain mx-auto block"
                         :class="{ 'transition-opacity duration-300': isTransitioning }"
                         @dragstart.prevent>
                    
                    <!-- Navigation arrows -->
                    <button v-if="currentImageIndex > 0" 
                            @click="goToPrevious"
                            class="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 text-3xl font-bold image-modal-nav-button rounded-full w-12 h-12 flex items-center justify-center">
                        ‹
                    </button>
                    
                    <button v-if="currentImageIndex < totalImages - 1" 
                            @click="goToNext"
                            class="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 text-3xl font-bold image-modal-nav-button rounded-full w-12 h-12 flex items-center justify-center">
                        ›
                    </button>
                </div>
                
                <!-- Image counter and thumbnails -->
                <div class="mt-4 text-center">
                    <div class="text-white text-sm mb-2">
                        {{ currentImageIndex + 1 }} / {{ totalImages }}
                    </div>
                    
                    <!-- Thumbnail navigation -->
                    <div v-if="totalImages > 1" class="flex justify-center gap-2 max-w-full overflow-x-auto pb-2">
                        <button v-for="(image, index) in images" 
                                :key="index"
                                @click="currentImageIndex = index"
                                class="flex-shrink-0 w-12 h-12 rounded border-2 overflow-hidden image-modal-thumbnail"
                                :class="index === currentImageIndex ? 'border-blue-500' : 'border-gray-500'">
                            <img :src="image" 
                                 :alt="'Thumbnail ' + (index + 1)"
                                 class="w-full h-full object-cover">
                        </button>
                    </div>
                </div>
                
                <!-- Swipe indicator -->
                <div class="mt-2 text-center text-gray-400 text-xs">
                    {{ totalImages > 1 ? 'Swipe or use arrow keys to navigate' : '' }}
                </div>
            </div>
        </div>
    `
};

// Post Modal Component
const PostModal = {
    props: ['post'],
    emits: ['close', 'save'],
    setup(props, { emit }) {
        const form = reactive({
            id: null,
            description: '',
            status: 'pending',
            images: []
        });

        const currentImages = ref([]);
        const isUploading = ref(false);

        // Initialize form when post prop changes
        const initForm = () => {
            if (props.post) {
                form.id = props.post.id;
                form.description = props.post.description;
                form.status = props.post.status;
                currentImages.value = [...(props.post.images || [])];
            } else {
                form.id = null;
                form.description = '';
                form.status = 'pending';
                currentImages.value = [];
            }
        };

        // Initialize form on mount and when post changes
        onMounted(initForm);

        const getCreds = () => {
            const credsStr = localStorage.getItem('creds');
            if (!credsStr) throw new Error('Missing credentials');
            return JSON.parse(credsStr);
        };

        const uploadToImgBB = async (file) => {
            const creds = getCreds();
            const apiKey = creds.imgbb.apiKey;
            const formData = new FormData();
            formData.append('key', apiKey);
            formData.append('image', file);
            
            const response = await fetch('https://api.imgbb.com/1/upload', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            if (data && data.success && data.data && data.data.url) {
                return data.data.url;
            } else {
                throw new Error('ImgBB upload failed');
            }
        };

        const handleImageUpload = async (event) => {
            const files = Array.from(event.target.files);
            isUploading.value = true;
            
            for (const file of files) {
                if (file && file.type.startsWith('image/')) {
                    try {
                        // Add placeholder
                        currentImages.value.push({ uploading: true });
                        
                        const url = await uploadToImgBB(file);
                        
                        // Replace placeholder with actual URL
                        const idx = currentImages.value.findIndex(img => img.uploading);
                        if (idx !== -1) {
                            currentImages.value[idx] = url;
                        }
                    } catch (err) {
                        alert('Failed to upload image to ImgBB.');
                        // Remove placeholder
                        const idx = currentImages.value.findIndex(img => img.uploading);
                        if (idx !== -1) {
                            currentImages.value.splice(idx, 1);
                        }
                    }
                }
            }
            
            isUploading.value = false;
            event.target.value = ''; // Reset input
        };

        const removeImage = (index) => {
            currentImages.value.splice(index, 1);
        };

        const handleSubmit = () => {
            if (!form.description.trim()) {
                alert('Please enter a post description');
                return;
            }
            
            const postData = {
                id: form.id,
                description: form.description.trim(),
                status: form.status,
                images: currentImages.value.filter(img => typeof img === 'string')
            };
            
            emit('save', postData);
        };

        const closeModal = () => {
            emit('close');
        };

        // Watch for post prop changes
        const unwatchPost = Vue.watch(() => props.post, initForm, { immediate: true });

        return {
            form,
            currentImages,
            isUploading,
            handleImageUpload,
            removeImage,
            handleSubmit,
            closeModal
        };
    },
    template: `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" @click.self="closeModal">
            <div class="bg-white rounded-lg shadow-lg w-full max-w-lg p-6 relative">
                <span @click="closeModal" class="absolute top-4 right-4 text-2xl text-gray-400 hover:text-gray-700 cursor-pointer">&times;</span>
                <h2 class="text-xl font-semibold mb-4">{{ post ? 'Edit Post' : 'Add New Post' }}</h2>
                
                <form @submit.prevent="handleSubmit" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Post Images:</label>
                        <input 
                            type="file" 
                            accept="image/*" 
                            multiple 
                            @change="handleImageUpload"
                            class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100">
                        
                        <div class="flex flex-wrap gap-2 mt-2">
                            <div v-for="(image, index) in currentImages" :key="index" class="relative inline-block">
                                <img v-if="typeof image === 'string'" :src="image" :alt="'Preview ' + (index + 1)" class="w-20 h-20 object-cover rounded border border-gray-200 shadow-sm">
                                <div v-else-if="image.uploading" class="w-20 h-20 flex items-center justify-center bg-gray-100 text-gray-400 rounded border border-gray-200 text-xs">Uploading...</div>
                                <button v-if="typeof image === 'string'" @click="removeImage(index)" type="button" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold hover:bg-red-600">×</button>
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Post Description:</label>
                        <textarea 
                            v-model="form.description" 
                            rows="4" 
                            required 
                            placeholder="Enter your Instagram post description..."
                            class="block w-full border border-gray-300 rounded p-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Status:</label>
                        <select v-model="form.status" class="block w-full border border-gray-300 rounded p-2 focus:ring-blue-500 focus:border-blue-500">
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>
                    
                    <div class="flex justify-end gap-2">
                        <button type="submit" :disabled="isUploading" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded shadow disabled:opacity-50">
                            {{ isUploading ? 'Uploading...' : 'Save Post' }}
                        </button>
                        <button type="button" @click="closeModal" class="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded shadow">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `
};

// Main App
createApp({
    components: {
        QrModal,
        PostModal,
        ImageModal
    },
    setup() {
        const showQrModal = ref(!localStorage.getItem('creds'));
        const showModal = ref(false);
        const editingPost = ref(null);
        const posts = ref([]);
        const currentPage = ref(1);
        const pageSize = ref(10);
        const totalPosts = ref(0);
        const supabaseClient = ref(null);
        
        // Image modal state
        const showImageModal = ref(false);
        const modalImages = ref([]);
        const modalCurrentIndex = ref(0);

        const maxPage = computed(() => Math.max(1, Math.ceil(totalPosts.value / pageSize.value)));

        const initSupabase = (creds) => {
            const SUPABASE_URL = creds.supabase.url;
            const SUPABASE_KEY = creds.supabase.key;
            supabaseClient.value = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        };

        const getCreds = () => {
            const credsStr = localStorage.getItem('creds');
            if (!credsStr) throw new Error('Missing credentials');
            return JSON.parse(credsStr);
        };

        const loadPosts = async () => {
            if (!supabaseClient.value) return;

            // Get total count
            const { count, error: countError } = await supabaseClient.value
                .from('posts')
                .select('*', { count: 'exact', head: true });
            
            if (!countError) {
                totalPosts.value = count || 0;
            }

            // Get paginated posts
            const from = (currentPage.value - 1) * pageSize.value;
            const to = from + pageSize.value - 1;

            const { data, error } = await supabaseClient.value
                .from('posts')
                .select('*')
                .order('id', { ascending: true })
                .range(from, to);

            if (error) {
                alert('Failed to load posts from Supabase.');
                posts.value = [];
            } else {
                posts.value = data || [];
            }
        };

        const handleCredentialsLoaded = (creds) => {
            showQrModal.value = false;
            initSupabase(creds);
            loadPosts();
        };

        const openModal = (post = null) => {
            editingPost.value = post;
            showModal.value = true;
        };

        const closeModal = () => {
            showModal.value = false;
            editingPost.value = null;
        };

        const openImageModal = (images, startIndex = 0) => {
            modalImages.value = images;
            modalCurrentIndex.value = startIndex;
            showImageModal.value = true;
        };

        const closeImageModal = () => {
            showImageModal.value = false;
            modalImages.value = [];
            modalCurrentIndex.value = 0;
        };

        const handleSavePost = async (postData) => {
            if (!supabaseClient.value) return;

            if (postData.id) {
                // Update existing post
                const { error } = await supabaseClient.value
                    .from('posts')
                    .update({
                        description: postData.description,
                        status: postData.status,
                        images: postData.images,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', postData.id);

                if (error) {
                    alert('Failed to update post in Supabase.');
                    return;
                }

                // Update local post
                const post = posts.value.find(p => p.id === postData.id);
                if (post) {
                    Object.assign(post, postData, { updated_at: new Date().toISOString() });
                }
            } else {
                // Create new post
                const { data, error } = await supabaseClient.value
                    .from('posts')
                    .insert({
                        description: postData.description,
                        status: postData.status,
                        images: postData.images,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .select();

                if (error) {
                    alert('Failed to add post to Supabase.');
                    return;
                }

                if (data && data[0]) {
                    posts.value.push(data[0]);
                    totalPosts.value++;
                }
            }

            closeModal();
        };

        const editPost = (post) => {
            openModal(post);
        };

        const deletePost = async (id) => {
            if (!confirm('Are you sure you want to delete this post?')) return;
            if (!supabaseClient.value) return;

            const { error } = await supabaseClient.value
                .from('posts')
                .delete()
                .eq('id', id);

            if (error) {
                alert('Failed to delete post from Supabase.');
                return;
            }

            posts.value = posts.value.filter(post => post.id !== id);
            totalPosts.value--;
        };

        const toggleStatus = async (post) => {
            if (!supabaseClient.value) return;

            const newStatus = post.status === 'approved' ? 'pending' : 'approved';

            const { error } = await supabaseClient.value
                .from('posts')
                .update({
                    status: newStatus,
                    updated_at: new Date().toISOString()
                })
                .eq('id', post.id);

            if (error) {
                alert('Failed to update status in Supabase.');
                return;
            }

            post.status = newStatus;
            post.updated_at = new Date().toISOString();
        };

        const prevPage = () => {
            if (currentPage.value > 1) {
                currentPage.value--;
                loadPosts();
            }
        };

        const nextPage = () => {
            if (currentPage.value < maxPage.value) {
                currentPage.value++;
                loadPosts();
            }
        };

        

        // Initialize app if credentials exist
        onMounted(() => {
            if (!showQrModal.value) {
                try {
                    const creds = getCreds();
                    initSupabase(creds);
                    loadPosts();
                } catch (e) {
                    showQrModal.value = true;
                }
            }
        });

        // Keyboard shortcuts
        onMounted(() => {
            const handleKeydown = (e) => {
                if (e.ctrlKey && e.key === 'n') {
                    e.preventDefault();
                    openModal();
                }
                if (e.key === 'Escape') {
                    closeModal();
                }
            };

            document.addEventListener('keydown', handleKeydown);

            // Cleanup
            return () => {
                document.removeEventListener('keydown', handleKeydown);
            };
        });

        return {
            showQrModal,
            showModal,
            editingPost,
            posts,
            currentPage,
            maxPage,
            showImageModal,
            modalImages,
            modalCurrentIndex,
            handleCredentialsLoaded,
            openModal,
            closeModal,
            openImageModal,
            closeImageModal,
            handleSavePost,
            editPost,
            deletePost,
            toggleStatus,
            prevPage,
            nextPage
        };
    }
}).mount('#app');