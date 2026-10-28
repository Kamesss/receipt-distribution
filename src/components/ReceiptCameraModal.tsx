/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface ReceiptCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaptureDataUrl: (dataUrl: string, mimeType: string) => void;
}

export const ReceiptCameraModal: React.FC<ReceiptCameraModalProps> = ({
  isOpen,
  onClose,
  onCaptureDataUrl,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopStream();
      setCapturedPreview(null);
      setCameraError(null);
      return;
    }

    startCamera(facingMode);

    return () => {
      stopStream();
    };
  }, [isOpen, facingMode]);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async (mode: 'environment' | 'user') => {
    stopStream();
    setCameraError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to access camera. Check browser permissions or upload a photo from gallery.';
      setCameraError(msg);
    }
  };

  const handleTakeSnapshot = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 960;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedPreview(dataUrl);
  };

  const handleConfirmCapture = () => {
    if (!capturedPreview) return;
    onCaptureDataUrl(capturedPreview, 'image/jpeg');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-modal-title"
    >
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="camera-modal-title" className="text-base font-semibold text-slate-900">
              Capture Receipt Photo
            </h2>
            <p className="text-xs text-slate-500">
              Align the receipt edges within the frame so item prices and tax lines are clearly legible.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            aria-label="Close camera modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative bg-slate-950 aspect-4/3 w-full flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="max-w-md px-6 text-center">
              <AlertCircle className="mx-auto mb-3 h-8 w-8 text-amber-400" />
              <p className="text-sm font-medium text-white mb-1">Camera Access Unavailable</p>
              <p className="text-xs text-slate-400 mb-4">{cameraError}</p>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-900 bg-white rounded-lg hover:bg-slate-100 transition-colors"
              >
                Use Photo Gallery Upload Instead
              </button>
            </div>
          ) : capturedPreview ? (
            <img
              src={capturedPreview}
              alt="Captured receipt preview"
              className="h-full w-full object-contain"
            />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              {/* Subtle receipt framing guide */}
              <div className="pointer-events-none absolute inset-6 rounded-lg border border-dashed border-white/40" />
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-5 py-3.5">
          {!capturedPreview ? (
            <>
              <button
                type="button"
                onClick={() =>
                  setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
                }
                disabled={!!cameraError}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Flip Camera
              </button>

              <button
                type="button"
                onClick={handleTakeSnapshot}
                disabled={!!cameraError}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Camera className="h-4 w-4" />
                Take Photo
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setCapturedPreview(null)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
              >
                Retake Photo
              </button>

              <button
                type="button"
                onClick={handleConfirmCapture}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
              >
                <CheckCircle2 className="h-4 w-4" />
                Run Receipt OCR
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
