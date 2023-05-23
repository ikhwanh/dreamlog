const AudioContext =
    window.AudioContext || window.webkitAudioContext || window.mozAudioContext;

class CustomMediaRecorder extends MediaRecorder {
    constructor(stream, options, els) {
        super(stream, options)

        Object.assign(this, els)

        this.chunks = []
        this.ondataavailable = (e) => {
            this.chunks.push(e.data)
        }

        this.onstart = (e) => {
            this.statusEl.innerText = 'recording'
        }

        this.onstop = (e) => {
            this.statusEl.innerText = 'active'
            const blobFile = new Blob(this.chunks, { type: 'audio/wav' })

            const el = this.recordTemplate.cloneNode()
            el.id = null
            el.style.display = 'block'
            el.innerText = this.recordTemplate
                .innerText
                .toString()
                .replace(/(\r\n|\n|\r)/gm, '')
                .replace('audio.wav', `audio-${new Date().getTime()}.wav`)
            el.href = URL.createObjectURL(blobFile)

            this.recordTemplate.parentElement.appendChild(el)

            this._reset()
        }
    }

    _reset() {
        this.chunks = []
    }

}

class Recorder {
    DEFAULT_VOL = 30
    WAIT_TIME = 3000

    constructor(els) {
        Object.assign(this, els)
        this.els = els

        this._lastUpdate = null
        this.activated = false;

        this.audioCtx = null
        this.micNode = null
        this.volumeMeterNode = null
        this.mediaRecorder = null
        this.stream = null

        this.triggerVolume = this.volumeInp.value || this.DEFAULT_VOL
    }

    async activate() {
        if (!this.stream) {
            await this._init()
        }

        this.statusEl.innerText = 'active'
        this.recordBtn.innerText = 'Wake up'
        this.activated = true
    }

    async deactivate() {
        this.statusEl.innerText = 'inactive'
        this.recordBtn.innerText = 'Sleep now'
        this.activated = false
    }

    async _init() {
        // prevent phone to sleep
        await navigator.wakeLock.request('screen')

        this.audioCtx = new AudioContext()
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        this.micNode = this.audioCtx.createMediaStreamSource(this.stream)
        await this.audioCtx.audioWorklet.addModule("volume-meter-processor.js")
        this.volumeMeterNode = new AudioWorkletNode(
            this.audioCtx,
            "volume-meter"
        );

        this.micNode.connect(this.volumeMeterNode)
        this.mediaRecorder = new CustomMediaRecorder(this.stream, {}, this.els)

        this.volumeMeterNode.port.onmessage = ({ data }) => {
            if (!this.activated) {
                if (this.mediaRecorder.state == 'recording') {
                    this.mediaRecorder.stop()
                }
                return;
            }

            const value = data * 500;
            if (value >= this.triggerVolume) {
                this._resetTime()
                if (this.mediaRecorder.state == 'inactive') {
                    this.mediaRecorder.start()
                }
            }

            if (this.mediaRecorder.state == 'recording') {
                this._stopRecordAfterNoActivity()
            }
        };
    }

    _resetTime() {
        this._lastUpdate = new Date().getTime()
    }

    _stopRecordAfterNoActivity() {
        const currentUpdate = new Date().getTime()
        if ((currentUpdate - this._lastUpdate) >= this.WAIT_TIME) {
            this.mediaRecorder.stop()
        } else {
            console.log('wait')
        }
    }
}

window.onload = () => {
    const recordBtn = document.getElementById('record-btn')
    const volumeInp = document.getElementById('vol')
    const statusEl = document.getElementById('status')
    const recordTemplate = document.getElementById('record')

    const recorder = new Recorder({ recordBtn, volumeInp, statusEl, recordTemplate })

    recordBtn.addEventListener('click', (e) => {
        if (recorder.activated) {
            recorder.deactivate()
        } else {
            recorder.activate()
        }
    })
}