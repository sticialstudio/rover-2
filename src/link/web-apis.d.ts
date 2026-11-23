// Minimal typings for the bits of Web Serial and Web Bluetooth this app uses
// (Chrome / Edge; not in TypeScript's DOM lib yet).

interface SerialPort extends EventTarget {
  open(options: { baudRate: number }): Promise<void>
  close(): Promise<void>
  readonly readable: ReadableStream<Uint8Array> | null
  readonly writable: WritableStream<Uint8Array> | null
  getInfo(): { usbVendorId?: number; usbProductId?: number; bluetoothServiceClassId?: number | string }
}
interface Serial extends EventTarget {
  requestPort(options?: { filters?: unknown[]; allowedBluetoothServiceClassIds?: (number | string)[] }): Promise<SerialPort>
}

type BluetoothServiceUUID = number | string
interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  readonly value: DataView | null
  readonly properties: { write: boolean; writeWithoutResponse: boolean; notify: boolean }
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
  writeValue(value: Uint8Array | ArrayBuffer | DataView): Promise<void>
  writeValueWithoutResponse?(value: Uint8Array | ArrayBuffer | DataView): Promise<void>
}
interface BluetoothRemoteGATTService {
  getCharacteristic(uuid: BluetoothServiceUUID): Promise<BluetoothRemoteGATTCharacteristic>
}
interface BluetoothRemoteGATTServer {
  readonly connected: boolean
  connect(): Promise<BluetoothRemoteGATTServer>
  disconnect(): void
  getPrimaryService(uuid: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>
}
interface BluetoothDevice extends EventTarget {
  readonly name?: string
  readonly gatt?: BluetoothRemoteGATTServer
}
interface Bluetooth {
  requestDevice(options: {
    filters?: ({ services?: BluetoothServiceUUID[] } | { namePrefix: string })[]
    optionalServices?: BluetoothServiceUUID[]
    acceptAllDevices?: boolean
  }): Promise<BluetoothDevice>
}

interface Navigator {
  readonly serial?: Serial
  readonly bluetooth?: Bluetooth
}
