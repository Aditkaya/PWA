const urlB64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const subscribeToPush = async (userId: number) => {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported in this browser');
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    
    // Ganti dengan PUBLIC_KEY dari hasil generate
    const publicVapidKey = 'BHok1fN427b5Dw2yNMGgiAPdbfG3QLdZdyCAtOTnNIvuFOfJCTY7_OXyfSFpwUePQOnrW_234sF4WM7xZh5k4ac';
    const applicationServerKey = urlB64ToUint8Array(publicVapidKey);

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });
    }

    const subscriptionData = subscription.toJSON();

    // Kirim ke backend
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId,
        endpoint: subscriptionData.endpoint,
        keys: subscriptionData.keys
      })
    });

    if (res.ok) {
      console.log('Berhasil berlangganan notifikasi push');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Gagal berlangganan push notification:', error);
    return false;
  }
};
