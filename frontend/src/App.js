/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useRef, useEffect } from "react";
import "./App.css";

function App() {
  // Navigation state
  const [currentPage, setCurrentPage] = useState("home"); // home, input_employee, attendance, history

  // Initial employees data
  const initialEmployees = [
   
  ];

  // Input Employee state
  const [employeeName, setEmployeeName] = useState("");
  const [employeeDepartment, setEmployeeDepartment] = useState("IT");
  const [employeePhoto, setEmployeePhoto] = useState(null);
  const [employeePhotoPreview, setEmployeePhotoPreview] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [employeeSubmitMessage, setEmployeeSubmitMessage] = useState("");
  const [viewingPhoto, setViewingPhoto] = useState(null);
  const [comparingAttendance, setComparingAttendance] = useState(null);
 
  // Attendance state
  const [faceImage, setFaceImage] = useState(null);
  const [facePreview, setFacePreview] = useState(null);
  const [result, setResult] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [loading, setLoading] = useState(false);
  const [attendanceLog, setAttendanceLog] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null); // Will be set to first employee when loaded
  const [cameraMode, setCameraMode] = useState(false);
  const [attendanceType, setAttendanceType] = useState("masuk"); // masuk or keluar
  const [realtimeResult, setRealtimeResult] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [realtimeFrame, setRealtimeFrame] = useState(null);
  const [captureAutoReplaceCountdown, setCaptureAutoReplaceCountdown] = useState(null);
  
  // In-memory photo storage (NOT in localStorage to avoid quota issues)
  const attendancePhotosRef = useRef({}); // {recordId: {attendancePhoto, databasePhoto}}
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null); // Ref untuk file input element
  const realtimeIntervalRef = useRef(null);
  const autoCaptureRef = useRef(false);
  const autoCaptureTimeoutRef = useRef(null); // Track timeout untuk auto close camera

  // ============ LOCAL STORAGE EFFECTS ============
  // One-time cleanup: remove corrupted data with photos from localStorage on app start
  useEffect(() => {
    console.log("🔍 Performing startup cleanup of localStorage...");
    
    // Clean attendanceLog
    const savedLog = localStorage.getItem("attendanceLog");
    if (savedLog) {
      try {
        let log = JSON.parse(savedLog);
        let hadPhotos = false;
        
        // Check for photos and remove them
        log = log.map(record => {
          if (record.attendancePhoto || record.databasePhoto) {
            hadPhotos = true;
          }
          const { attendancePhoto, databasePhoto, ...clean } = record;
          return clean;
        });
        
        if (hadPhotos) {
          console.log("✅ Cleaned attendance log - removed photo data");
          localStorage.setItem("attendanceLog", JSON.stringify(log));
        }
      } catch (err) {
        console.warn("⚠️ Could not parse attendance log, resetting...");
        localStorage.removeItem("attendanceLog");
      }
    }
    
    // Clean lastResult
    const savedResult = localStorage.getItem("lastResult");
    if (savedResult) {
      try {
        let result = JSON.parse(savedResult);
        if (result.attendancePhoto || result.databasePhoto) {
          console.log("✅ Cleaned last result - removed photo data");
          const { attendancePhoto, databasePhoto, ...clean } = result;
          localStorage.setItem("lastResult", JSON.stringify(clean));
        }
      } catch (err) {
        console.warn("⚠️ Could not parse last result, removing...");
        localStorage.removeItem("lastResult");
      }
    }
  }, []); // Run only once on mount

  // Load employees dari localStorage saat pertama kali
  useEffect(() => {
    const savedEmployees = localStorage.getItem("employees");
    if (savedEmployees) {
      try {
        const loadedEmployees = JSON.parse(savedEmployees);
        setEmployees(loadedEmployees);
        // Jangan auto-select employee pertama - biarkan user memilih
      } catch (err) {
        console.error("Error loading employees:", err);
        setEmployees(initialEmployees);
      }
    } else {
      setEmployees(initialEmployees);
    }
  }, []);

  // Save employees ke localStorage setiap kali berubah
  useEffect(() => {
    if (employees.length > 0) {
      localStorage.setItem("employees", JSON.stringify(employees));
    }
  }, [employees]);

  // Load attendance log dari localStorage
  useEffect(() => {
    const savedLog = localStorage.getItem("attendanceLog");
    if (savedLog) {
      try {
        let loadedLog = JSON.parse(savedLog);
        let hasPhotos = false;
        
        // Clean up old records that might have photos - migrate to new format
        loadedLog = loadedLog.map(record => {
          // Check if photos exist
          if (record.attendancePhoto || record.databasePhoto) {
            hasPhotos = true;
          }
          // Remove photos if they exist (for old data compatibility)
          const { attendancePhoto, databasePhoto, ...cleanRecord } = record;
          return cleanRecord;
        });
        
        // If we found photos, immediately save cleaned version to localStorage
        if (hasPhotos) {
          console.log("🧹 Detected old data with photos - cleaning and saving...");
          localStorage.setItem("attendanceLog", JSON.stringify(loadedLog));
        }
        
        setAttendanceLog(loadedLog);
      } catch (err) {
        console.error("Error loading attendance log:", err);
        setAttendanceLog([]);
      }
    }
  }, []);

  // Save attendance log ke localStorage setiap kali berubah
  useEffect(() => {
    if (attendanceLog.length > 0) {
      // Safeguard: remove any photos that might accidentally be in records
      const cleanLog = attendanceLog.map(record => {
        const { attendancePhoto, databasePhoto, ...cleanRecord } = record;
        return cleanRecord;
      });
      
      // Add size check before saving
      const jsonString = JSON.stringify(cleanLog);
      const sizeInBytes = new Blob([jsonString]).size;
      
      if (sizeInBytes > 1000000) { // 1MB limit as safeguard
        console.warn(`⚠️ Attendance log too large (${(sizeInBytes/1024/1024).toFixed(2)}MB). Keeping only recent 10 records.`);
        const recentLog = cleanLog.slice(0, 10);
        localStorage.setItem("attendanceLog", JSON.stringify(recentLog));
      } else {
        localStorage.setItem("attendanceLog", JSON.stringify(cleanLog));
      }
    }
  }, [attendanceLog]);

  // Save result ke localStorage setiap kali berubah (hanya saat di halaman attendance)
  useEffect(() => {
    if (result && currentPage === "attendance") {
      // Jangan simpan photo ke localStorage - simpan hanya metadata
      const resultToSave = {
        ...result,
        attendancePhoto: undefined,
        databasePhoto: undefined,
      };
      localStorage.setItem("lastResult", JSON.stringify(resultToSave));
    }
  }, [result, currentPage]);

  // Load result dari localStorage saat pertama kali (hanya jika di halaman attendance)
  useEffect(() => {
    if (currentPage === "attendance") {
      const savedResult = localStorage.getItem("lastResult");
      if (savedResult) {
        try {
          const result = JSON.parse(savedResult);
          // Try to restore photos from in-memory storage
          if (result.id && attendancePhotosRef.current[result.id]) {
            const inMemoryPhotos = attendancePhotosRef.current[result.id];
            result.attendancePhoto = inMemoryPhotos.attendancePhoto;
            result.databasePhoto = inMemoryPhotos.databasePhoto;
          }
          setResult(result);
        } catch (err) {
          console.error("Error loading result:", err);
        }
      }
    } else {
      // Clear result saat navigate keluar dari halaman attendance
      setResult(null);
      localStorage.removeItem("lastResult");
    }
  }, [currentPage]);

  // Update selectedEmployee validation - hanya untuk memastikan selected employee masih valid
  useEffect(() => {
    if (employees.length > 0 && selectedEmployee) {
      // Jika selectedEmployee sudah ada dan valid, keep it
      const employeeExists = employees.find((e) => e.id === selectedEmployee);
      if (!employeeExists) {
        // Jika employee yang dipilih sudah dihapus, reset ke null (placeholder)
        setSelectedEmployee(null);
      }
    }
  }, [employees]);

  // Clear result saat ganti pilihan karyawan dari dropdown
  useEffect(() => {
    if (currentPage === "attendance") {
      // Clear pending auto capture timeout
      if (autoCaptureTimeoutRef.current) {
        clearTimeout(autoCaptureTimeoutRef.current);
        autoCaptureTimeoutRef.current = null;
      }
      // Stop camera jika sedang aktif
      if (cameraMode) {
        stopCamera();
      }
      // Always clear result dan localStorage, regardless of state
      setResult(null);
      localStorage.removeItem("lastResult");
      // Clear face image dan preview
      setFaceImage(null);
      setFacePreview(null);
      // Clear realtime result juga
      setRealtimeResult(null);
      // Jangan clear autoCaptureRef di sini - biarkan startRealtimeComparison handle-nya
    }
  }, [selectedEmployee, currentPage]);

  // Reset selectedEmployee saat masuk ke halaman attendance
  useEffect(() => {
    if (currentPage === "attendance") {
      setSelectedEmployee(null);
    } else {
      // Bersihkan capture ketika keluar dari halaman attendance
      setFaceImage(null);
      setFacePreview(null);
      setRealtimeResult(null);
      setCaptureAutoReplaceCountdown(null);
    }
  }, [currentPage]);

  // ============ INPUT EMPLOYEE HANDLERS ============
  const handleEmployeePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEmployeePhoto(file);
      setEmployeePhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleAddEmployee = () => {
    if (!employeeName.trim() || !employeePhoto) {
      alert("Nama karyawan dan foto harus diisi!");
      return;
    }

    // Validasi: pastikan nama tidak kosong dan foto valid
    if (employeeName.trim().length < 3) {
      alert("Nama karyawan minimal 3 karakter!");
      return;
    }

    // Confirm sebelum save untuk memastikan data benar
    if (!window.confirm(`Yakin ingin menyimpan data:\n\nNama: ${employeeName}\nDepartemen: ${employeeDepartment}\n\n⚠️ Pastikan foto sudah sesuai dengan nama karyawan!`)) {
      return;
    }

    // Convert foto ke base64 untuk disimpan
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Photo = e.target.result;
      
      const newEmployee = {
        id: `emp${String(employees.length + 1).padStart(3, "0")}`,
        name: employeeName,
        department: employeeDepartment,
        photo: base64Photo, // Simpan foto dalam base64
      };

      setEmployees([...employees, newEmployee]);
      setEmployeeSubmitMessage(`✓ Karyawan "${employeeName}" berhasil ditambahkan!`);
      
      console.log("✅ Employee saved:", newEmployee.name, "ID:", newEmployee.id);
      
      // Reset form
      setEmployeeName("");
      setEmployeeDepartment("IT");
      setEmployeePhoto(null);
      setEmployeePhotoPreview(null);

      // Clear message after 3 seconds
      setTimeout(() => setEmployeeSubmitMessage(""), 3000);
    };
    reader.readAsDataURL(employeePhoto);
  };

  const clearEmployeeForm = () => {
    setEmployeeName("");
    setEmployeeDepartment("IT");
    setEmployeePhoto(null);
    setEmployeePhotoPreview(null);
    setEmployeeSubmitMessage("");
  };

  const deleteEmployee = (empId) => {
    const updatedEmployees = employees.filter((emp) => emp.id !== empId);
    setEmployees(updatedEmployees);
    setEmployeeSubmitMessage(`✓ Karyawan berhasil dihapus!`);
    setTimeout(() => setEmployeeSubmitMessage(""), 3000);
  };

  const clearAllData = () => {
    if (window.confirm("⚠️ Yakin ingin menghapus SEMUA data karyawan dan riwayat absensi? Tindakan ini tidak dapat dibatalkan!")) {
      localStorage.removeItem("employees");
      localStorage.removeItem("attendanceLog");
      setEmployees(initialEmployees);
      setAttendanceLog([]);
      setEmployeeSubmitMessage("✓ Semua data berhasil direset!");
      setTimeout(() => setEmployeeSubmitMessage(""), 3000);
    }
  };

  // ============ ATTENDANCE HANDLERS ============
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Convert file to data URL (base64) untuk preview yang persist
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result;
        setFaceImage(file); // Tetap simpan file object untuk upload ke server
        setFacePreview(dataUrl); // Simpan data URL untuk preview yang tidak akan invalid
        setResult(null);
        console.log("✅ File loaded and converted to data URL");
        console.log("   - Data URL length:", dataUrl.length, "bytes");
        console.log("   - Data URL valid:", dataUrl.startsWith("data:image/"));
      };
      reader.onerror = (error) => {
        console.error("❌ Error reading file:", error);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    setCameraMode(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Tunggu video siap (loadedmetadata) sebelum mulai capture
        videoRef.current.onloadedmetadata = () => {
          // Tambahkan null check untuk mencegah error saat videoRef.current menjadi null
          if (videoRef.current) {
            console.log("✅ Video loaded - dimensions:", videoRef.current.videoWidth, "x", videoRef.current.videoHeight);
            setTimeout(() => {
              startRealtimeComparison();
            }, 1000); // Lebih lama untuk stabilisasi
          }
        };
      }
    } catch (err) {
      alert("Tidak bisa mengakses kamera: " + err.message);
      setCameraMode(false);
    }
  };

  const startRealtimeComparison = () => {
    if (realtimeIntervalRef.current) {
      clearInterval(realtimeIntervalRef.current);
    }

    autoCaptureRef.current = false;

    // ⚠️ PENTING: Cache semua employees SAAT CAMERA DIBUKA
    // Sistem akan compare dengan semua employees (auto-detection mode)
    const cachedEmployees = employees;
    if (!cachedEmployees || cachedEmployees.length === 0) {
      console.error("❌ No employees found!");
      alert("Belum ada data karyawan. Silakan tambahkan karyawan terlebih dahulu!");
      return;
    }

    // Inisialisasi realtimeResult dengan status awal (agar selalu tampil saat kamera dibuka)
    setRealtimeResult({
      distance: "N/A",
      match: false,
      status: "⏳ Menunggu deteksi wajah...",
    });

    // Tampilkan waiting message saat kamera dibuka
    setResult({
      timestamp: new Date().toLocaleString("id-ID"),
      employee: "Mendeteksi...",
      department: "-",
      type: attendanceType === "masuk" ? "Absensi Masuk" : "Absensi Keluar",
      typeShort: attendanceType,
      status: "⏳ Menunggu Verifikasi",
      match: null,
      distance: "N/A",
      attendancePhoto: null,
      databasePhoto: null,
    });
    
    console.log(`📷 Camera opened - Auto-detection mode (${cachedEmployees.length} employees)`);

    // Cache untuk database blobs dari semua employees
    // ⚠️ PENTING: Cache di-reset setiap kali startRealtimeComparison dipanggil
    let cachedDbBlobs = {};
    cachedEmployees.forEach((emp) => {
      cachedDbBlobs[emp.id] = null;
    });

    // ⏱️ BARU: Auto-capture setelah 3 detik
    let autoCaptureDelayRef = setTimeout(async () => {
      console.log("⏱️ 3 detik telah berlalu - Auto-capturing image...");
      
      if (videoRef.current && canvasRef.current && !autoCaptureRef.current) {
        try {
          // Validasi video readiness
          if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
            console.warn("Video not ready yet");
            return;
          }

          // Capture frame
          const videoWidth = videoRef.current.videoWidth;
          const videoHeight = videoRef.current.videoHeight;
          
          canvasRef.current.width = videoWidth;
          canvasRef.current.height = videoHeight;

          const context = canvasRef.current.getContext("2d");
          context.drawImage(videoRef.current, 0, 0, videoWidth, videoHeight);

          canvasRef.current.toBlob(async (blob) => {
            if (!blob || blob.size === 0) {
              console.warn("Blob kosong");
              return;
            }

            try {
              // Tampilkan preview capture foto
              const previewData = canvasRef.current.toDataURL();
              setFacePreview(previewData);
              setFaceImage(blob);
              
              // Tampilkan foto capture di result panel sebelah kanan (seperti upload mode)
              setResult({
                timestamp: new Date().toLocaleString("id-ID"),
                employee: "Memverifikasi...",
                department: "-",
                type: attendanceType === "masuk" ? "Absensi Masuk" : "Absensi Keluar",
                typeShort: attendanceType,
                status: "⏳ Sedang diproses...",
                match: null,
                distance: "N/A",
                attendancePhoto: previewData,
                databasePhoto: null,
              });
              console.log("📸 Foto capture ditampilkan di preview dan result panel");

              console.log("0% - Memulai verifikasi otomatis dari camera...");

              // AUTO DETECTION: Compare dengan semua employees
              let bestMatch = null;
              let bestDistance = Infinity;

              for (const emp of cachedEmployees) {
                if (!emp.photo) continue;

                // Cache database blob untuk setiap employee
                if (!cachedDbBlobs[emp.id]) {
                  const photoDataUri = emp.photo;
                  if (!photoDataUri.startsWith("data:image/")) {
                    continue;
                  }

                  const byteString = atob(photoDataUri.split(",")[1]);
                  const mimeString = photoDataUri.split(",")[0].match(/:(.*?);/)[1];
                  const ab = new ArrayBuffer(byteString.length);
                  const ia = new Uint8Array(ab);
                  for (let i = 0; i < byteString.length; i++) {
                    ia[i] = byteString.charCodeAt(i);
                  }
                  cachedDbBlobs[emp.id] = new Blob([ab], { type: mimeString });
                }

                // Verify dengan employee ini
                console.log(`25% - Checking ${emp.name}...`);
                
                const formData = new FormData();
                formData.append("img1", cachedDbBlobs[emp.id], "database.jpg");
                formData.append("img2", blob, "camera.jpg");
                // Tambahkan custom threshold yang lebih toleran (default Facenet512 cosine: 0.3 -> lebih toleran: 0.5)
                formData.append("threshold", "0.5");
                formData.append("enforce_detection", "false");

                console.log("50% - Mengirim ke server dengan threshold=0.5, enforce_detection=false");
                
                const verifyResponse = await fetch("http://localhost:5000/verify", {
                  method: "POST",
                  body: formData,
                });

                if (!verifyResponse.ok) {
                  continue;
                }

                const verifyData = await verifyResponse.json();
                const distance = verifyData.distance || Infinity;
                const verified = verifyData.verified || false;

                console.log(`75% - ${emp.name}: distance=${distance.toFixed(2)}, verified=${verified}`);

                // ⚠️ PENTING: HANYA track sebagai bestMatch jika verified === true
                if (verified && distance < bestDistance) {
                  bestDistance = distance;
                  bestMatch = { employee: emp, verifyData };
                  console.log(`   ✅ Valid match found! Updated bestMatch to ${emp.name}`);
                }
              }

              // Jika ada match, simpan langsung
              if (bestMatch && bestMatch.verifyData.verified) {
                console.log("100% - Match found!");
                const employee = bestMatch.employee;

                const attendanceEntry = {
                  id: `${employee.id}_${Date.now()}`,
                  timestamp: new Date().toLocaleString("id-ID"),
                  employeeId: employee.id,
                  employee: employee.name,
                  department: employee.department,
                  type: attendanceType === "masuk" ? "Absensi Masuk" : "Absensi Keluar",
                  typeShort: attendanceType,
                  status: "✓ Terverifikasi",
                  match: true,
                  distance: bestMatch.verifyData.distance?.toFixed(2) || "N/A",
                  // NOTE: Photos stored IN-MEMORY ONLY (attendancePhotosRef) to avoid localStorage quota exceeded
                  // DO NOT add attendancePhoto or databasePhoto here
                };

                // Store photos IN-MEMORY ONLY (not in localStorage to avoid quota issues)
                attendancePhotosRef.current[attendanceEntry.id] = {
                  attendancePhoto: previewData,
                  databasePhoto: employee.photo,
                };

                // Create entry with photos for immediate display
                const resultWithPhotos = {
                  ...attendanceEntry,
                  attendancePhoto: previewData,
                  databasePhoto: employee.photo,
                };

                setResult(resultWithPhotos);
                const newLog = [attendanceEntry, ...attendanceLog.slice(0, 49)];
                setAttendanceLog(newLog);
                // No direct localStorage.setItem - let useEffect handle it consistently with photo stripping

                console.log("✅ Attendance record saved:", employee.name);
              } else {
                // Tidak ada match - retry capture setelah 2 detik
                console.log("❌ No match found - Retrying capture...");
                setRealtimeResult({
                  distance: bestDistance !== Infinity ? bestDistance.toFixed(2) : "N/A",
                  match: false,
                  status: "✗ Tidak Cocok - Retry...",
                });

                // Mulai countdown 3 detik sebelum auto-replace dengan foto capture baru
                let countdownValue = 3;
                setCaptureAutoReplaceCountdown(countdownValue);
                
                const countdownInterval = setInterval(() => {
                  countdownValue--;
                  setCaptureAutoReplaceCountdown(countdownValue);
                  if (countdownValue <= 0) {
                    clearInterval(countdownInterval);
                    setCaptureAutoReplaceCountdown(null);
                  }
                }, 1000);

                // Reschedule auto-capture setelah 2 detik untuk retry
                autoCaptureTimeoutRef.current = setTimeout(async () => {
                  console.log("⏱️ 2 detik telah berlalu - Auto-capturing image again...");
                  clearInterval(countdownInterval);
                  setCaptureAutoReplaceCountdown(null);
                  
                  if (videoRef.current && canvasRef.current && !autoCaptureRef.current) {
                    try {
                      // Validasi video readiness
                      if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
                        console.warn("Video not ready yet");
                        return;
                      }

                      // Capture frame
                      const videoWidth = videoRef.current.videoWidth;
                      const videoHeight = videoRef.current.videoHeight;
                      
                      canvasRef.current.width = videoWidth;
                      canvasRef.current.height = videoHeight;

                      const context = canvasRef.current.getContext("2d");
                      context.drawImage(videoRef.current, 0, 0, videoWidth, videoHeight);

                      canvasRef.current.toBlob(async (blob) => {
                        if (!blob || blob.size === 0) {
                          console.warn("Blob kosong");
                          return;
                        }

                        try {
                          // Tampilkan preview capture foto retry
                          const previewData = canvasRef.current.toDataURL();
                          setFacePreview(previewData);
                          setFaceImage(blob);
                          
                          // Tampilkan foto capture retry di result panel sebelah kanan
                          setResult({
                            timestamp: new Date().toLocaleString("id-ID"),
                            employee: "Memverifikasi ulang...",
                            department: "-",
                            type: attendanceType === "masuk" ? "Absensi Masuk" : "Absensi Keluar",
                            typeShort: attendanceType,
                            status: "⏳ Retry - Sedang diproses...",
                            match: null,
                            distance: "N/A",
                            attendancePhoto: previewData,
                            databasePhoto: null,
                          });
                          console.log("📸 Foto retry capture ditampilkan di preview dan result panel");

                          console.log("0% - Memulai verifikasi ulang dari camera...");

                          // AUTO DETECTION: Compare dengan semua employees
                          let retryBestMatch = null;
                          let retryBestDistance = Infinity;

                          for (const emp of cachedEmployees) {
                            if (!emp.photo) continue;

                            // Verify dengan employee ini
                            console.log(`25% - Checking ${emp.name}...`);
                            
                            const formData = new FormData();
                            formData.append("img1", cachedDbBlobs[emp.id], "database.jpg");
                            formData.append("img2", blob, "camera.jpg");
                            // Tambahkan custom threshold yang lebih toleran (default Facenet512 cosine: 0.3 -> lebih toleran: 0.5)
                            formData.append("threshold", "0.5");
                            formData.append("enforce_detection", "false");

                            console.log("50% - Mengirim ke server dengan threshold=0.5, enforce_detection=false");
                            
                            const verifyResponse = await fetch("http://localhost:5000/verify", {
                              method: "POST",
                              body: formData,
                            });

                            if (!verifyResponse.ok) {
                              continue;
                            }

                            const verifyData = await verifyResponse.json();
                            const distance = verifyData.distance || Infinity;
                            const verified = verifyData.verified || false;

                            console.log(`75% - ${emp.name}: distance=${distance.toFixed(2)}, verified=${verified}`);

                            // ⚠️ PENTING: HANYA track sebagai bestMatch jika verified === true
                            if (verified && distance < retryBestDistance) {
                              retryBestDistance = distance;
                              retryBestMatch = { employee: emp, verifyData };
                              console.log(`   ✅ Valid match found! Updated retryBestMatch to ${emp.name}`);
                            }
                          }

                          // Jika ada match sekarang, simpan langsung
                          if (retryBestMatch && retryBestMatch.verifyData.verified) {
                            console.log("100% - Match found on retry!");
                            const employee = retryBestMatch.employee;
                            const previewData = canvasRef.current.toDataURL();

                            const attendanceEntry = {
                              id: `${employee.id}_${Date.now()}`,
                              timestamp: new Date().toLocaleString("id-ID"),
                              employeeId: employee.id,
                              employee: employee.name,
                              department: employee.department,
                              type: attendanceType === "masuk" ? "Absensi Masuk" : "Absensi Keluar",
                              typeShort: attendanceType,
                              status: "✓ Terverifikasi",
                              match: true,
                              distance: retryBestMatch.verifyData.distance?.toFixed(2) || "N/A",
                              // NOTE: Photos stored IN-MEMORY ONLY (attendancePhotosRef) to avoid localStorage quota exceeded
                              // DO NOT add attendancePhoto or databasePhoto here
                            };

                            // Store photos IN-MEMORY ONLY (not in localStorage to avoid quota issues)
                            attendancePhotosRef.current[attendanceEntry.id] = {
                              attendancePhoto: previewData,
                              databasePhoto: employee.photo,
                            };

                            // Create entry with photos for immediate display
                            const resultWithPhotos = {
                              ...attendanceEntry,
                              attendancePhoto: previewData,
                              databasePhoto: employee.photo,
                            };

                            setResult(resultWithPhotos);
                            const newLog = [attendanceEntry, ...attendanceLog.slice(0, 49)];
                            setAttendanceLog(newLog);
                            // No direct localStorage.setItem - let useEffect handle it consistently with photo stripping

                            console.log("✅ Attendance record saved on retry:", employee.name);
                          } else {
                            // Masih tidak match - retry lagi
                            console.log("❌ Still no match - Retrying again...");
                            setRealtimeResult({
                              distance: retryBestDistance !== Infinity ? retryBestDistance.toFixed(2) : "N/A",
                              match: false,
                              status: "✗ Tidak Cocok - Retry...",
                            });

                            // Reschedule lagi setelah 2 detik
                            autoCaptureTimeoutRef.current = setTimeout(() => {
                              // Recursive retry - akan terus berulang sampai match
                              // Bisa dijalankan kembali dengan cara memanggil fungsi yang sama
                              console.log("Scheduling next retry...");
                            }, 2000);
                          }
                        } catch (err) {
                          console.error("Error during retry verification:", err);
                        }
                      });
                    } catch (err) {
                      console.error("Error during retry capture:", err);
                    }
                  }
                }, 2000); // 2 detik untuk retry
              }
            } catch (err) {
              console.error("Error during auto-capture verification:", err);
            }
          });
        } catch (err) {
          console.error("Error during auto-capture:", err);
        }
      }
    }, 3000); // 3 detik

    // Simpan ref untuk cleanup
    // eslint-disable-next-line no-unused-vars
    const originalAutoCaptureTimeoutRef = autoCaptureTimeoutRef;
    autoCaptureTimeoutRef.current = autoCaptureDelayRef;
  };

  // eslint-disable-next-line no-unused-vars
  const handleAutoCapture = async (previewData, blob, verifyData, employeeParam) => {
    setLoading(true);

    try {
      // ⚠️ CRITICAL: Gunakan employeeParam yang di-pass, jangan lookup dari selectedEmployee
      // (selectedEmployee bisa berubah selama async operation)
      const selectedEmp = employeeParam;
      const selectedEmpId = selectedEmp.id;
      
      if (!selectedEmp) {
        console.error("❌ Employee data not available!");
        setLoading(false);
        return;
      }

      // Generate unique record ID
      const recordId = `${selectedEmpId}_${Date.now()}`;

      const attendanceEntry = {
        id: recordId, // ID untuk reference foto
        timestamp: new Date().toLocaleString("id-ID"),
        employeeId: selectedEmpId,
        employee: selectedEmp.name,
        department: selectedEmp.department,
        type: attendanceType === "masuk" ? "Absensi Masuk" : "Absensi Keluar",
        typeShort: attendanceType,
        status: "✓ Terverifikasi",
        match: true,
        distance: verifyData.distance?.toFixed(2) || "N/A",
        // ⚠️ TIDAK store photos di localStorage - hanya reference ID
      };

      // Store photos IN-MEMORY (tidak di localStorage)
      attendancePhotosRef.current[recordId] = {
        attendancePhoto: previewData,
        databasePhoto: selectedEmp.photo,
      };

      console.log("✅ ATTENDANCE RECORD SAVED:");
      console.log("   Record ID:", recordId);
      console.log("   Employee ID:", selectedEmpId);
      console.log("   Name:", attendanceEntry.employee);
      console.log("   Department:", attendanceEntry.department);
      console.log("   Distance:", attendanceEntry.distance);
      console.log("   Type:", attendanceEntry.type);
      console.log("   Timestamp:", attendanceEntry.timestamp);
      console.log("   Photos stored in-memory (not in localStorage)");

      setResult(attendanceEntry);
      // Keep last 50 records only
      setAttendanceLog([attendanceEntry, ...attendanceLog.slice(0, 49)]);

      // Auto close camera setelah 1 detik (lebih cepat dari sebelumnya 3 detik)
      autoCaptureTimeoutRef.current = setTimeout(() => {
        stopCamera();
        // JANGAN hapus faceImage dan facePreview - biarkan capture tetap tampil di right side
        setRealtimeResult(null);
        autoCaptureRef.current = false;
        autoCaptureTimeoutRef.current = null;
      }, 1000);
    } catch (err) {
      console.error("❌ Auto capture error:", err);
    }

    setLoading(false);
  };

  const stopRealtimeComparison = () => {
    if (realtimeIntervalRef.current) {
      clearInterval(realtimeIntervalRef.current);
      realtimeIntervalRef.current = null;
    }
    setRealtimeResult(null);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      context.drawImage(videoRef.current, 0, 0, 320, 240);
      
      // Simpan preview dari canvas sebelum blob conversion
      const previewData = canvasRef.current.toDataURL();
      
      canvasRef.current.toBlob((blob) => {
        setFaceImage(blob);
        setFacePreview(previewData);
      });
      
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
    }
    stopRealtimeComparison();
    // Clear auto-capture timeout jika ada
    if (autoCaptureTimeoutRef.current) {
      clearTimeout(autoCaptureTimeoutRef.current);
      autoCaptureTimeoutRef.current = null;
    }
    setCameraMode(false);
  };

  // eslint-disable-next-line no-unused-vars
  const handleVerify = async () => {
    if (!faceImage) {
      alert("Silakan pilih atau ambil foto terlebih dahulu!");
      return;
    }

    if (employees.length === 0) {
      alert("Belum ada data karyawan. Silakan tambahkan karyawan terlebih dahulu!");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      console.log("0% - Memulai verifikasi otomatis...");
      console.log(`Comparing against ${employees.length} employees`);

      // AUTO DETECTION: Compare dengan semua employees
      let bestMatch = null;
      let bestDistance = Infinity;

      for (const emp of employees) {
        if (!emp.photo) continue;

        console.log(`25% - Checking ${emp.name}...`);

        // Convert base64 foto database ke blob
        let dbBlob;
        try {
          const photoDataUri = emp.photo;
          if (!photoDataUri.startsWith("data:image/")) {
            continue; // Skip invalid format
          }
          
          const byteString = atob(photoDataUri.split(",")[1]);
          const mimeString = photoDataUri.split(",")[0].match(/:(.*?);/)[1];
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          dbBlob = new Blob([ab], { type: mimeString });
        } catch (err) {
          console.error(`Error processing photo for ${emp.name}:`, err);
          continue; // Try next employee
        }

        // Verify dengan employee ini
        const formData = new FormData();
        formData.append("img1", dbBlob, "employee_photo.jpg");
        formData.append("img2", faceImage, "attendance_photo.jpg");
        // Tambahkan custom threshold yang lebih toleran
        formData.append("threshold", "0.5");
        formData.append("enforce_detection", "false");

        console.log("50% - Mengirim ke server dengan threshold=0.5, enforce_detection=false");
        
        const verifyResponse = await fetch("http://localhost:5000/verify", {
          method: "POST",
          body: formData,
        });

        if (!verifyResponse.ok) {
          continue; // Try next employee
        }

        const data = await verifyResponse.json();
        const distance = data.distance || Infinity;
        const verified = data.verified || false;

        console.log(`${emp.name}: distance=${distance.toFixed(2)}, verified=${verified}`);

        // ⚠️ PENTING: HANYA track sebagai bestMatch jika verified === true
        if (verified && distance < bestDistance) {
          bestDistance = distance;
          bestMatch = { employee: emp, verifyData: data };
          console.log(`   ✅ Valid match found! Updated bestMatch to ${emp.name}`);
        }
      }

      console.log("75% - Memproses hasil...");

      // Jika ada match
      if (bestMatch && bestMatch.verifyData.verified) {
        const employee = bestMatch.employee;
        const recordId = `${employee.id}_${Date.now()}`;
        const attendanceEntry = {
          id: recordId,
          timestamp: new Date().toLocaleString("id-ID"),
          employee: employee.name,
          department: employee.department,
          type: attendanceType === "masuk" ? "Absensi Masuk" : "Absensi Keluar",
          typeShort: attendanceType,
          status: "✓ Terverifikasi",
          match: true,
          distance: bestMatch.verifyData.distance?.toFixed(2) || "N/A",
          // NOTE: Photos stored IN-MEMORY ONLY (attendancePhotosRef) to avoid localStorage quota exceeded
          // DO NOT add attendancePhoto or databasePhoto here
        };

        // Store photos IN-MEMORY ONLY (not in localStorage to avoid quota issues)
        attendancePhotosRef.current[recordId] = {
          attendancePhoto: facePreview,
          databasePhoto: employee.photo,
        };

        // Create entry with photos for immediate display
        const resultWithPhotos = {
          ...attendanceEntry,
          attendancePhoto: facePreview,
          databasePhoto: employee.photo,
        };

        console.log("100% - Verifikasi selesai!");
        setResult(resultWithPhotos);
        const newLog = [attendanceEntry, ...attendanceLog.slice(0, 49)];
        setAttendanceLog(newLog);
        // No direct localStorage.setItem - let useEffect handle it consistently with photo stripping
        console.log("✅ Match found:", employee.name);
      } else {
        // Tidak ada match
        console.log("100% - Verifikasi selesai!");
        const noMatchEntry = {
          timestamp: new Date().toLocaleString("id-ID"),
          employee: "Tidak Ditemukan",
          department: "-",
          type: attendanceType === "masuk" ? "Absensi Masuk" : "Absensi Keluar",
          typeShort: attendanceType,
          status: "✗ Tidak Cocok dengan Siapapun",
          match: false,
          distance: bestDistance !== Infinity ? bestDistance.toFixed(2) : "N/A",
          // NOTE: Photos stored IN-MEMORY ONLY to avoid localStorage quota exceeded
          // DO NOT add attendancePhoto or databasePhoto here
        };

        // Create entry with photos for immediate display
        const resultWithPhotos = {
          ...noMatchEntry,
          attendancePhoto: facePreview,
          databasePhoto: null,
        };

        setResult(resultWithPhotos);
        const newLog = [noMatchEntry, ...attendanceLog.slice(0, 49)];
        setAttendanceLog(newLog);
        // No direct localStorage.setItem - let useEffect handle it consistently with photo stripping
        console.log("❌ No match found. Best distance:", bestDistance !== Infinity ? bestDistance.toFixed(2) : "N/A");
      }
    } catch (err) {
      console.error("Verification exception:", err);
      setResult({ 
        error: "❌ Terjadi Kesalahan\n\nError: " + (err.message || "Unknown error")
      });
    }

    setLoading(false);
  };

  // eslint-disable-next-line no-unused-vars
  const clearData = () => {
    setFaceImage(null);
    setFacePreview(null);
    // JANGAN clear result dan attendancePhoto - biarkan foto capture tetap ditampilkan
    // setResult(null);
    localStorage.removeItem("lastResult");
    // Clear file input element juga agar bisa upload file yang sama lagi
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const clearCapturePhoto = () => {
    // Fungsi khusus untuk clear capture photo saat user mau mulai absensi baru
    setFaceImage(null);
    setFacePreview(null);
    setResult(null);
    setCaptureAutoReplaceCountdown(null);
    localStorage.removeItem("lastResult");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ============ RENDER HOME PAGE ============
  const renderHome = () => (
    <div className="home-container">
      <div className="home-header">
        <h1>🔐 Sistem Manajemen Absensi</h1>
        <p>Menggunakan Face Recognition Technology</p>
      </div>

      <div className="home-menu">
        <div 
          className="menu-card employee-card"
          onClick={() => setCurrentPage("input_employee")}
        >
          <div className="menu-icon">👤</div>
          <h3>Input Data Karyawan</h3>
          <p>Tambahkan data karyawan baru ke dalam sistem</p>
          <button className="menu-button">Mulai →</button>
        </div>

        <div 
          className="menu-card attendance-card"
          onClick={() => setCurrentPage("attendance")}
        >
          <div className="menu-icon">✓</div>
          <h3>Menu Absensi</h3>
          <p>Verifikasi kehadiran menggunakan face recognition</p>
          <button className="menu-button">Mulai →</button>
        </div>

        <div 
          className="menu-card history-card"
          onClick={() => setCurrentPage("history")}
        >
          <div className="menu-icon">📊</div>
          <h3>Cek History Absensi</h3>
          <p>Lihat riwayat absensi dan laporan kehadiran</p>
          <button className="menu-button">Lihat →</button>
        </div>
      </div>
    </div>
  );

  // ============ RENDER INPUT EMPLOYEE PAGE ============
  const renderInputEmployee = () => (
    <div className="page-container">
      <div className="page-header">
        <button className="back-button" onClick={() => setCurrentPage("home")}>
          ← Kembali
        </button>
        <h1>👤 Input Data Karyawan Baru</h1>
        <p>Tambahkan informasi karyawan dan foto untuk verifikasi</p>
      </div>

      <div className="main-content">
        {/* Left Panel - Form */}
        <div className="panel form-panel">
          <h2>Form Data Karyawan</h2>

          {/* Employee List */}
          <div className="employee-list-section">
            <h3>Daftar Karyawan ({employees.length})</h3>
            <p className="storage-info">💾 Data disimpan di Local Storage</p>
            <div className="employee-list">
              {employees.map((emp) => (
                <div key={emp.id} className="employee-item">
                  <div className="emp-info">
                    <span className="emp-name">{emp.name}</span>
                    <span className="emp-dept">{emp.department}</span>
                  </div>
                  <div className="emp-actions">
                    <button
                      className="view-btn"
                      onClick={() => setViewingPhoto(emp)}
                      title="Lihat foto karyawan"
                    >
                      👁
                    </button>
                    <button
                      className="delete-btn"
                      onClick={() => deleteEmployee(emp.id)}
                      title="Hapus karyawan"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Input Form */}
        <div className="panel input-form-panel">
          <h2>Tambah Karyawan Baru</h2>

          {/* Name Input */}
          <div className="form-group">
            <label>Nama Lengkap Karyawan *</label>
            <input
              type="text"
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              placeholder="Contoh: Budi Santoso"
              className="form-input"
            />
          </div>

          {/* Department Select */}
          <div className="form-group">
            <label>Departemen *</label>
            <select
              value={employeeDepartment}
              onChange={(e) => setEmployeeDepartment(e.target.value)}
              className="form-input"
            >
              <option value="IT">IT</option>
              <option value="HR">HR</option>
              <option value="Finance">Finance</option>
              <option value="Marketing">Marketing</option>
              <option value="Operations">Operations</option>
              <option value="Sales">Sales</option>
            </select>
          </div>

          {/* Photo Upload */}
          <div className="form-group">
            <label>Foto Karyawan (untuk database) *</label>
            <div className="file-upload-large">
              <input
                type="file"
                accept="image/*"
                onChange={handleEmployeePhotoChange}
                id="employee-photo"
              />
              <label htmlFor="employee-photo" className="upload-label-large" onClick={clearEmployeeForm}>
                <div className="upload-icon">📸</div>
                <div>Klik untuk upload atau drag & drop</div>
              </label>
            </div>
          </div>

          {/* Photo Preview */}
          {employeePhotoPreview && (
            <div className="preview-section">
              <h4>Preview Foto:</h4>
              <img src={employeePhotoPreview} alt="Preview" className="preview-img-large" />
            </div>
          )}

          {/* Success Message */}
          {employeeSubmitMessage && (
            <div className="success-message">
              {employeeSubmitMessage}
            </div>
          )}

          {/* Action Buttons */}
          <div className="form-buttons">
            <button
              className="btn btn-primary"
              onClick={handleAddEmployee}
            >
              ✓ Tambah Karyawan
            </button>
            <button
              className="btn btn-secondary"
              onClick={clearEmployeeForm}
            >
              🔄 Bersihkan Form
            </button>
          </div>

          {/* Clear All Data Button */}
          <button
            className="btn btn-danger"
            onClick={clearAllData}
            style={{ marginTop: 10, width: "100%" }}
          >
            ⚠️ Reset Semua Data
          </button>
        </div>
      </div>
    </div>
  );

  // ============ RENDER ATTENDANCE PAGE ============
  const renderAttendance = () => (
    <div className="page-container">
      <div className="page-header">
        <button className="back-button" onClick={() => setCurrentPage("home")}>
          ← Kembali
        </button>
        <h1>✓ Menu Absensi Karyawan</h1>
        <p>Verifikasi wajah untuk verifikasi kehadiran</p>
      </div>

      <div className="main-content">
        {/* Left Panel - Input */}
        <div className="panel input-panel">
          <h2>Input Wajah Karyawan</h2>

          {/* Auto Detection Info */}
          <div className="form-group">
            <div style={{ 
              padding: "12px", 
              backgroundColor: "#e3f2fd", 
              borderRadius: "4px",
              color: "#1976d2",
              fontSize: "14px",
              fontWeight: "500"
            }}>
              🔍 <strong>Mode Deteksi Otomatis</strong>
              <br/>
              <span style={{ fontSize: "12px", fontWeight: "normal" }}>Sistem akan otomatis mencocokkan wajah dengan {employees.length} karyawan di database</span>
            </div>
          </div>

          {/* Attendance Type Selection */}
          <div className="form-group">
            <label>Tipe Absensi:</label>
            <div className="attendance-type-selector">
              <button
                className={`type-btn ${attendanceType === "masuk" ? "active" : ""}`}
                onClick={() => setAttendanceType("masuk")}
              >
                🔓 Absensi Masuk
              </button>
              <button
                className={`type-btn ${attendanceType === "keluar" ? "active" : ""}`}
                onClick={() => setAttendanceType("keluar")}
              >
                🔒 Absensi Keluar
              </button>
            </div>
          </div>

          {/* Camera/File Tabs */}
          <div className="input-tabs">
            {/* <button
              className={`tab-btn ${!cameraMode ? "active" : ""}`}
              onClick={() => {
                setCameraMode(false);
                // Hanya clear input, tidak clear result
                setFaceImage(null);
                setFacePreview(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
            >
              📁 Upload Foto
            </button> */}
            <button 
              className={`tab-btn ${cameraMode ? "active" : ""}`} 
              onClick={() => {
                setCameraMode(false);
                // clearData() dipindah ke sini untuk tidak clear result saat buka camera
                setFaceImage(null);
                setFacePreview(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
                startCamera();
              }}
            >
              📷 Ambil Foto
            </button>
          </div>

          {/* Camera Mode */}
          {cameraMode && (
            <div className="camera-section">
              <video ref={videoRef} autoPlay playsInline style={{ width: "100%", borderRadius: 8, backgroundColor: "#000" }} />
              <canvas ref={canvasRef} style={{ display: "none" }} />
              
              {/* Realtime Result Display */}
              {realtimeResult && (
                <div className={`realtime-result ${realtimeResult.match ? "match" : "no-match"}`}>
                  <div className="realtime-status">{realtimeResult.status}</div>
                  <div className="realtime-distance">
                    📏 Distance: <strong>{realtimeResult.distance}</strong>
                  </div>
                  {realtimeResult.match ? (
                    <div className="auto-capture-info">🔄 Auto Capture...</div>
                  ) : (
                    <div className="realtime-hint">Arahkan wajah lebih dekat ke kamera</div>
                  )}
                </div>
              )}

              {!autoCaptureRef.current && (
                <div className="camera-buttons">
                  <button className="btn btn-primary" onClick={capturePhoto}>
                    📸 Ambil Foto Manual
                  </button>
                  <button className="btn btn-secondary" onClick={stopCamera}>
                    ✕ Tutup Kamera
                  </button>
                </div>
              )}
            </div>
          )}

          {/* File Upload */}
          {!cameraMode && (
            <div className="file-upload">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                id="file-input"
              />
              <label htmlFor="file-input" className="upload-label">
                Klik untuk memilih foto atau drag & drop
              </label>
            </div>
          )}

          {/* Preview - Only for Upload Mode */}
          {facePreview && !cameraMode && (
            <div className="preview-section">
              <img 
                src={facePreview} 
                alt="Preview" 
                className="preview-img"
                onError={(e) => {
                  console.error("❌ Error loading preview:", e);
                  e.target.style.display = "none";
                  e.target.parentElement.innerHTML += "<p style='color: #d32f2f;'>Gagal memuat preview</p>";
                }}
              />
            </div>
          )}

          {/* Buttons */}
          <div className="action-buttons">
            <button className="btn btn-secondary" onClick={() => {
              // Hanya clear input, tidak clear result
              setFaceImage(null);
              setFacePreview(null);
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
            }}>
              🔄 Bersihkan Input
            </button>
          </div>

          {/* Clear Capture Photo Button */}
          {result && result.attendancePhoto && (
            <div style={{ marginTop: 10 }}>
              <button 
                className="btn btn-danger" 
                onClick={clearCapturePhoto}
                style={{ width: "100%" }}
              >
                🗑️ Hapus Hasil Capture
              </button>
            </div>
          )}
        </div>

        {/* Right Panel - Results & Logs */}
        <div className="panel result-panel">
          {/* Result */}
          {result && (
            <div className={`result-box ${result.error ? "error" : (result.match ? "success" : "error")}`}>
              <h3>Hasil Verifikasi</h3>
              <div className="result-content">
                {result.error ? (
                  <div className="error-message" style={{ color: "#d32f2f", whiteSpace: "pre-wrap" }}>
                    {result.error}
                  </div>
                ) : (
                  <>
                    <div className="result-item">
                      <span className="label">Status:</span>
                      <span className={`status ${result.match ? "verified" : "failed"}`}>
                        {result.status}
                      </span>
                    </div>
                    <div className="result-item">
                      <span className="label">Nama:</span>
                      <span>{result.employee}</span>
                    </div>
                    <div className="result-item">
                      <span className="label">Departemen:</span>
                      <span>{result.department}</span>
                    </div>
                    <div className="result-item">
                      <span className="label">Tipe Absensi:</span>
                      <span>{result.type}</span>
                    </div>
                    <div className="result-item">
                      <span className="label">Waktu:</span>
                      <span>{result.timestamp}</span>
                    </div>
                    {result.distance && (
                      <div className="result-item">
                        <span className="label">Distance:</span>
                        <span>{result.distance}</span>
                      </div>
                    )}
                    {/* Tampilkan pesan tambahan jika tidak cocok */}
                    {result.distance && result.match === false && (
                      <div style={{ 
                        marginTop: 12, 
                        padding: 10, 
                        backgroundColor: "#fff3cd", 
                        borderRadius: 4,
                        color: "#856404",
                        fontSize: 14,
                        fontWeight: 500
                      }}>
                        ⚠️ Wajah tidak cocok dengan {result.employee}. Silakan coba lagi atau pilih karyawan lain.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Display Captured Photo */}
          {result && result.attendancePhoto && (
            <div style={{ marginTop: 20 }}>
              <h3>📸 Hasil Capture</h3>
              <div style={{ 
                backgroundColor: "#f5f5f5",
                padding: "15px",
                borderRadius: "8px",
                textAlign: "center",
                position: "relative"
              }}>
                <img 
                  src={result.attendancePhoto} 
                  alt="Captured" 
                  onError={(e) => {
                    console.error("❌ Error loading attendance photo:", e);
                    e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f0f0f0' width='100' height='100'/%3E%3Ctext x='50' y='50' text-anchor='middle' dy='.3em' fill='%23999'%3EImage Error%3C/text%3E%3C/svg%3E";
                  }}
                  style={{ 
                    maxWidth: "100%", 
                    maxHeight: "300px",
                    borderRadius: "6px",
                    border: "2px solid #ddd"
                  }} 
                />
                
                {/* Auto-Replace Countdown */}
                {captureAutoReplaceCountdown !== null && result.match === false && (
                  <div style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    backgroundColor: "#ff9800",
                    color: "white",
                    padding: "8px 12px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px"
                  }}>
                    <span>⏱️ Auto replace in {captureAutoReplaceCountdown}s</span>
                  </div>
                )}
                
                <div style={{ 
                  marginTop: "10px",
                  fontSize: "12px",
                  color: "#666"
                }}>
                  📷 Foto yang diambil dari {cameraMode ? "Kamera" : "Upload"}
                  {result.match === false && " (Tidak Cocok - Capture Ulang)"}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ============ RENDER HISTORY PAGE ============
  const renderHistory = () => (
    <div className="page-container">
      <div className="page-header">
        <button className="back-button" onClick={() => setCurrentPage("home")}>
          ← Kembali
        </button>
        <h1>📊 History Absensi Karyawan</h1>
        <p>Laporan lengkap riwayat kehadiran karyawan</p>
      </div>

      <div className="history-content">
        <div className="panel history-panel">
          <h2>📋 Riwayat Absensi</h2>
          
          {/* Summary Stats */}
          <div className="history-stats">
            <div className="stat-card">
              <div className="stat-number">{attendanceLog.length}</div>
              <div className="stat-label">Total Absensi</div>
            </div>
            <div className="stat-card">
              <div className="stat-number" style={{ color: "#28a745" }}>
                {attendanceLog.filter((log) => log.match).length}
              </div>
              <div className="stat-label">Terverifikasi</div>
            </div>
            <div className="stat-card">
              <div className="stat-number" style={{ color: "#dc3545" }}>
                {attendanceLog.filter((log) => !log.match).length}
              </div>
              <div className="stat-label">Tidak Cocok</div>
            </div>
          </div>

          {/* Full Attendance Log Table */}
          <div className="history-table-section">
            <h3>Daftar Lengkap Absensi</h3>
            <div className="full-log-table">
              {attendanceLog.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Waktu</th>
                      <th>Nama Karyawan</th>
                      <th>Departemen</th>
                      <th>Tipe Absensi</th>
                      <th>Status</th>
                      <th>Distance</th>
                      <th>View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceLog.map((log, idx) => (
                      <tr key={idx} className={log.match ? "success-row" : "error-row"}>
                        <td className="row-number">{idx + 1}</td>
                        <td className="time">{log.timestamp}</td>
                        <td className="emp-name-col">{log.employee}</td>
                        <td className="dept-col">{log.department}</td>
                        <td className="type-col">
                          <span className={`type-badge ${log.typeShort}`}>
                            {log.typeShort === "masuk" ? "🔓 Masuk" : "🔒 Keluar"}
                          </span>
                        </td>
                        <td>
                          <span className={`status-cell ${log.match ? "verified" : "failed"}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="distance-col">{log.distance}</td>
                        <td className="action-col">
                          <button
                            className="view-history-btn"
                            onClick={() => setComparingAttendance(log)}
                            title="Bandingkan foto"
                          >
                            👁
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <p>Belum ada data absensi</p>
                  <small>Mulai melakukan absensi untuk melihat history di sini</small>
                </div>
              )}
            </div>
          </div>

          {/* Export/Clear Options */}
          <div className="history-actions">
            <button
              className="btn btn-secondary"
              onClick={() => {
                if (attendanceLog.length > 0) {
                  const dataStr = JSON.stringify(attendanceLog, null, 2);
                  const dataBlob = new Blob([dataStr], { type: "application/json" });
                  const url = URL.createObjectURL(dataBlob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `attendance_report_${new Date().getTime()}.json`;
                  link.click();
                }
              }}
            >
              📥 Export Data
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (window.confirm("⚠️ Yakin ingin menghapus semua history absensi? Tindakan ini tidak dapat dibatalkan!")) {
                  setAttendanceLog([]);
                  localStorage.removeItem("attendanceLog");
                }
              }}
            >
              🗑️ Hapus Semua History
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ============ PHOTO MODAL ============
  const PhotoModal = ({ employee, onClose }) => {
    if (!employee) return null;

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose}>✕</button>
          <h3>Foto Karyawan - {employee.name}</h3>
          <div className="modal-body">
            <img src={employee.photo} alt={employee.name} className="modal-image" />
            <div className="employee-details">
              <p><strong>Nama:</strong> {employee.name}</p>
              <p><strong>Departemen:</strong> {employee.department}</p>
              <p><strong>ID:</strong> {employee.id}</p>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={onClose} style={{ marginTop: 10 }}>
            Tutup
          </button>
        </div>
      </div>
    );
  };

  // ============ ATTENDANCE COMPARISON MODAL ============
  const ComparisonModal = ({ attendance, onClose }) => {
    if (!attendance) return null;

    // Get photos dari in-memory storage dulu, jika tidak ada cek dari attendance object
    const inMemoryPhotos = attendancePhotosRef.current[attendance.id];
    const photos = inMemoryPhotos || {
      attendancePhoto: attendance.attendancePhoto || null,
      databasePhoto: attendance.databasePhoto || null,
    };

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose}>✕</button>
          <h3>Perbandingan Foto Absensi - {attendance.employee}</h3>
          
          <div className="comparison-info">
            <p><strong>Waktu:</strong> {attendance.timestamp}</p>
            <p><strong>Tipe:</strong> {attendance.type}</p>
            <p><strong>Status:</strong> <span className={`status-badge ${attendance.match ? "verified" : "failed"}`}>{attendance.status}</span></p>
            <p><strong>Distance Score:</strong> {attendance.distance}</p>
          </div>

          <div className="comparison-container">
            <div className="comparison-photo">
              <h4>📸 Foto Database (Referensi)</h4>
              {photos.databasePhoto ? (
                <img 
                  src={photos.databasePhoto} 
                  alt="Database" 
                  className="comparison-image"
                  onError={(e) => {
                    console.error("❌ Error loading database photo:", e);
                    e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23f0f0f0' width='200' height='200'/%3E%3Ctext x='100' y='100' text-anchor='middle' dy='.3em' fill='%23999'%3EImage Error%3C/text%3E%3C/svg%3E";
                  }}
                />
              ) : (
                <div style={{ padding: 40, textAlign: "center", color: "#999" }}>Foto tidak tersedia</div>
              )}
            </div>
            <div className="comparison-divider"></div>
            <div className="comparison-photo">
              <h4>📷 Foto Absensi (Upload/Kamera)</h4>
              {photos.attendancePhoto ? (
                <img 
                  src={photos.attendancePhoto} 
                  alt="Attendance" 
                  className="comparison-image"
                  onError={(e) => {
                    console.error("❌ Error loading attendance photo:", e);
                    e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23f0f0f0' width='200' height='200'/%3E%3Ctext x='100' y='100' text-anchor='middle' dy='.3em' fill='%23999'%3EImage Error%3C/text%3E%3C/svg%3E";
                  }}
                />
              ) : (
                <div style={{ padding: 40, textAlign: "center", color: "#999" }}>Foto tidak tersedia</div>
              )}
            </div>
          </div>

          <button className="btn btn-secondary" onClick={onClose} style={{ marginTop: 20, width: "100%" }}>
            Tutup
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      {currentPage === "home" && renderHome()}
      {currentPage === "input_employee" && renderInputEmployee()}
      {currentPage === "attendance" && renderAttendance()}
      {currentPage === "history" && renderHistory()}
      
      {/* Photo Modal */}
      {viewingPhoto && <PhotoModal employee={viewingPhoto} onClose={() => setViewingPhoto(null)} />}
      
      {/* Comparison Modal */}
      {comparingAttendance && <ComparisonModal attendance={comparingAttendance} onClose={() => setComparingAttendance(null)} />}
    </div>
  );
}

export default App;
